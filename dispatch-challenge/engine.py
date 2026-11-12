"""Dispatch Day reference engine (deterministic).

Simulates one delivery route plan stop by stop and returns a SCOR scorecard.
The LTI tool should port this logic; this file is the source of truth for the math.

Usage:
  python3 engine.py scenario.json plan.json        # score one plan
  python3 engine.py scenario.json --anchors        # enumerate plan menu, print anchors
"""
import json, math, random, sys, itertools

# ---------- helpers ----------

def dist(a, b, circuity):
    return math.hypot(a[0] - b[0], a[1] - b[1]) * circuity

def hm(minutes):
    h, m = divmod(int(round(minutes)), 60)
    return f"{h:02d}:{m:02d}"

def parse_hm(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


class Scenario:
    def __init__(self, cfg):
        self.cfg = cfg
        self.c = cfg["route"]["circuity"]
        self.speed = cfg["route"]["avg_speed_mph"]
        self.depot = cfg["route"]["depot"]
        self.stops = {s["id"]: s for s in cfg["stops"]}
        self.chargers = {c["id"]: c for c in cfg.get("chargers", [])}
        self.v = cfg["vehicles"]
        self.costs = cfg["costs"]
        self.rng = random.Random(cfg["seed"])
        # deterministic queue / uptime draws per charger, fixed at load
        self.draws = {}
        for cid in sorted(self.chargers):
            ch = self.chargers[cid]
            up = self.rng.random() < ch.get("uptime", 1.0)
            r = self.rng.random()
            wait = 0
            acc = 0.0
            for w, p in ch.get("queue_dist", [[0, 1.0]]):
                acc += p
                if r <= acc:
                    wait = w
                    break
            fixed = ch.get("fixed_wait_min")
            self.draws[cid] = {"up": up if "fixed_up" not in ch else ch["fixed_up"],
                               "wait": fixed if fixed is not None else wait}

    def pos(self, node):
        if node == "DEPOT":
            return self.depot
        if node in self.stops:
            return self.stops[node]["xy"]
        return self.chargers[node]["xy"]


def apply_events(scn, events):
    """Events modify the world. Only the engine applies effects."""
    for e in events or []:
        eff = e.get("effect", {})
        for cid, patch in eff.get("chargers", {}).items():
            scn.draws[cid].update(patch)
        for k, v in eff.get("costs", {}).items():
            scn.costs[k] = v
        for sid, patch in eff.get("stops", {}).items():
            scn.stops[sid].update(patch)


# ---------- simulation ----------

def simulate(cfg, plan, events=None):
    scn = Scenario(json.loads(json.dumps(cfg)))
    apply_events(scn, events)
    veh = plan["vehicle"]                   # "gas" | "ev"
    seq = plan["sequence"]
    if isinstance(seq, str):
        seq = cfg["sequences"][seq]
    charge_plan = {c["at"]: c for c in plan.get("charges", [])}  # at: stop id or charger id
    V = scn.v[veh]
    t = parse_hm(cfg["route"]["start"])
    t0 = t
    log, notes = [], []
    miles = 0.0
    energy_cost = 0.0
    fees = 0.0
    fuel_units = 0.0       # gallons or kWh consumed
    kwh_by_source = {}
    late = 0
    stranded = False

    if veh == "ev":
        cap = V["usable_kwh"]
        soc = cap * plan.get("start_soc", 1.0)
        per_mile = V["kwh_per_mile"]
        reserve = cap * V["reserve_frac"]
        kwh_by_source["depot"] = soc
        energy_cost += soc * scn.costs["depot_kwh"]
    else:
        cap = V["tank_gal"]
        soc = cap
        per_mile = 1.0 / V["mpg"]
        reserve = cap * V["reserve_frac"]

    def drive(frm, to):
        nonlocal t, miles, soc, fuel_units
        d = dist(scn.pos(frm), scn.pos(to), scn.c)
        miles += d
        t += d / scn.speed * 60
        soc -= d * per_mile
        fuel_units += d * per_mile
        return d

    def charge_at_public(cid, target_kwh):
        nonlocal t, soc, energy_cost, fees
        ch = scn.chargers[cid]
        dr = scn.draws[cid]
        if not dr["up"]:
            notes.append(f"{cid} down on arrival")
            return False
        wait = dr["wait"]
        need = max(0.0, min(cap, target_kwh) - soc)
        mins = ch["overhead_min"] + need / ch["eff_kw"] * 60
        t += wait + mins
        soc += need
        energy_cost += need * ch["price_kwh"]
        fees += ch.get("session_fee", 0)
        kwh_by_source[cid] = kwh_by_source.get(cid, 0) + need
        log.append({"node": cid, "type": "charge", "arrive": None, "wait_min": wait,
                    "charge_min": round(mins), "kwh": round(need, 1), "depart": hm(t)})
        return True

    def remaining_need(idx_from):
        """kWh/gal to finish route from current node at position idx_from in path."""
        d = 0.0
        prev = path[idx_from]
        for n in path[idx_from + 1:]:
            d += dist(scn.pos(prev), scn.pos(n), scn.c)
            prev = n
        return d * per_mile

    def nearest_public(frm, to, exclude=()):
        best = None
        for cid, ch in scn.chargers.items():
            if ch["type"] != "public" or cid in exclude:
                continue
            det = dist(scn.pos(frm), ch["xy"], scn.c) + dist(ch["xy"], scn.pos(to), scn.c) - dist(scn.pos(frm), scn.pos(to), scn.c)
            reach = dist(scn.pos(frm), ch["xy"], scn.c) * per_mile
            if reach > soc:  # can't reach it
                continue
            if best is None or det < best[1]:
                best = (cid, det)
        return best

    path = ["DEPOT"] + list(seq) + ["DEPOT"]
    # planned public-charger visits are inserted as path nodes
    expanded = []
    for n in path:
        expanded.append(n)
        if n in charge_plan and charge_plan[n].get("then_public"):
            expanded.append(charge_plan[n]["then_public"])
    for cid, c in charge_plan.items():
        if cid in scn.chargers and scn.chargers[cid]["type"] == "public" and "after" in c:
            i = expanded.index(c["after"])
            expanded.insert(i + 1, cid)
    path = expanded

    i = 0
    cur = "DEPOT"
    tried_down = set()
    guard = 0
    while i < len(path) - 1:
        guard += 1
        if guard > 200:
            stranded = True
            notes.append("loop guard")
            break
        nxt = path[i + 1]
        leg = dist(scn.pos(cur), scn.pos(nxt), scn.c) * per_mile
        # default driver policy: if next leg would breach reserve, detour to nearest public charger
        def escape(node):
            # kWh needed from node to nearest public charger (or 0 if node is the depot = end of day)
            if node == "DEPOT":
                return 0.0
            ds = [dist(scn.pos(node), ch["xy"], scn.c) for cid2, ch in scn.chargers.items()
                  if ch["type"] == "public" and cid2 not in tried_down]
            return min(ds) * per_mile if ds else 0.0
        if nxt == "DEPOT":
            future_ok = soc - leg >= -1e-6
        else:
            future_ok = (soc - leg - (escape(nxt) if veh == "ev" and soc - leg < remaining_need(i) else 0)) >= reserve - 1e-6
        if not future_ok and not (nxt in scn.chargers):
            if veh == "gas":
                # gas stations are everywhere: 3 mi detour, 10 min, fill tank
                d_extra = 3.0
                miles += d_extra; t += d_extra / scn.speed * 60 + V["refuel_min"]
                soc -= d_extra * per_mile; fuel_units += d_extra * per_mile
                soc = cap
                notes.append("gas refuel stop")
                log.append({"node": "GAS", "type": "refuel", "depart": hm(t)})
            else:
                excl = set(tried_down) | ({cur} if cur in scn.chargers else set())
                pick = nearest_public(cur, nxt, exclude=excl)
                if pick is None or len(notes) > 20:
                    stranded = True
                    notes.append(f"stranded before {nxt}")
                    break
                cid = pick[0]
                path.insert(i + 1, cid)
                notes.append(f"default policy: detour to {cid}")
                continue
        drive(cur, nxt)
        if soc < -1e-9:
            stranded = True
            notes.append(f"stranded on way to {nxt}")
            break
        cur = nxt
        i += 1
        if cur in scn.chargers:
            need_total = remaining_need(i) + reserve
            ok = charge_at_public(cur, need_total)
            if not ok:
                tried_down.add(cur)
                # try another public charger from here
                alt = nearest_public(cur, path[i + 1], exclude=tried_down)
                if alt is None:
                    stranded = True
                    notes.append("no reachable working charger")
                    break
                path.insert(i + 1, alt[0])
            continue
        if cur in scn.stops:
            s = scn.stops[cur]
            arrive = t
            open_t, close_t = parse_hm(s["window"][0]), parse_hm(s["window"][1])
            wait = max(0, open_t - t)
            t += wait
            on_time = arrive <= close_t
            late += 0 if on_time else 1
            unload = s["unload_min"]
            entry = {"node": cur, "type": "stop", "arrive": hm(arrive), "window": s["window"],
                     "on_time": on_time, "wait_min": round(wait), "unload_min": unload}
            # opportunity charging during unload
            if veh == "ev" and cur in charge_plan and s.get("site_charger"):
                sc = s["site_charger"]
                avail = sc.get("available", True)
                if avail:
                    tgt = charge_plan[cur].get("target", "finish")
                    if tgt == "unload_only":
                        target = min(cap, soc + max(0, unload - sc["overhead_min"]) / 60 * sc["eff_kw"])
                    else:
                        target = min(cap, remaining_need(i) + reserve)
                    need = max(0.0, target - soc)
                    mins = sc["overhead_min"] + need / sc["eff_kw"] * 60
                    extra = max(0.0, mins - unload)
                    t += unload + extra
                    soc += need
                    energy_cost += need * sc["price_kwh"]
                    kwh_by_source[cur] = need
                    entry.update({"charge_kwh": round(need, 1), "extra_dwell_min": round(extra)})
                else:
                    notes.append(f"site charger at {cur} unavailable")
                    t += unload
            else:
                t += unload
            entry["depart"] = hm(t)
            log.append(entry)

    n_stops = len(seq)
    if stranded:
        visited = sum(1 for e in log if e["type"] == "stop")
        late += n_stops - visited
        energy_cost += 0
        fees += scn.costs["tow_fee"]
        t += scn.costs["tow_delay_min"]

    cycle_h = (t - t0) / 60
    if veh == "gas":
        energy_cost = fuel_units * scn.costs["gas_gal"]
        ghg = fuel_units * V["kg_co2e_per_gal"]
    else:
        ghg = fuel_units * scn.costs["grid_kg_per_kwh"]
        bought_elsewhere = sum(v for k, v in kwh_by_source.items() if k != "depot")
        depot_used = max(0.0, fuel_units - bought_elsewhere)
        energy_cost = energy_cost - kwh_by_source.get("depot", 0) * scn.costs["depot_kwh"] + depot_used * scn.costs["depot_kwh"]
    labor = cycle_h * scn.costs["driver_hr"]
    swap = scn.costs.get("vehicle_swap_fee", 0) if plan.get("swapped") else 0
    total = energy_cost + fees + labor + swap
    on_time_pct = (n_stops - late) / n_stops * 100
    return {
        "vehicle": veh, "miles": round(miles, 1), "cycle_h": round(cycle_h, 2),
        "on_time": f"{n_stops - late}/{n_stops}", "on_time_pct": round(on_time_pct, 1),
        "energy_cost": round(energy_cost, 2), "fees": round(fees + swap, 2), "labor": round(labor, 2),
        "total_cost": round(total, 2), "ghg_kg": round(ghg, 1), "stranded": stranded,
        "notes": notes, "log": log, "_end_min": t,
    }


def stress_agility(cfg, plan, events=None):
    """SCOR Agility proxy: on-time % when the plan is stress-tested.
    Public chargers take their worst published queue; site chargers run at 50% power."""
    c = json.loads(json.dumps(cfg))
    for ch in c.get("chargers", []):
        ch["fixed_wait_min"] = max(w for w, _ in ch.get("queue_dist", [[0, 1]]))
    for st in c["stops"]:
        if st.get("site_charger"):
            st["site_charger"]["eff_kw"] *= 0.5
    r = simulate(c, plan, events)
    return r["on_time_pct"]


def agility(result, event_time):
    """On-time % for stops arriving after the disruption takes effect."""
    after = [e for e in result["log"] if e["type"] == "stop" and parse_hm(e["arrive"]) >= parse_hm(event_time)]
    if not after:
        return 100.0
    return round(sum(e["on_time"] for e in after) / len(after) * 100, 1)


# ---------- scorecard ----------

def scale(x, best, worst):
    if best == worst:
        return 100.0
    v = (x - worst) / (best - worst) * 100
    return max(0.0, min(100.0, v))


def scorecard(cfg, result, agility_pct=None):
    a = cfg["anchors"]
    w = cfg["weights"]
    s = {
        "reliability": scale(result["on_time_pct"], a["on_time_pct"]["best"], a["on_time_pct"]["worst"]),
        "cost": scale(result["total_cost"], a["total_cost"]["best"], a["total_cost"]["worst"]),
        "responsiveness": scale(result["cycle_h"], a["cycle_h"]["best"], a["cycle_h"]["worst"]),
        "environmental": scale(result["ghg_kg"], a["ghg_kg"]["best"], a["ghg_kg"]["worst"]),
    }
    if result.get("stranded"):
        # a stranded van never completes the route: no credit for speed or emissions
        s["responsiveness"] = 0.0
        s["environmental"] = 0.0
    if "agility" in w:
        s["agility"] = agility_pct if agility_pct is not None else 100.0
    idx = sum(s[k] * w[k] for k in w) / sum(w.values())
    return {k: round(v, 1) for k, v in s.items()}, round(idx, 1)


# ---------- plan menu (for anchors and the reveal) ----------

def plan_menu(cfg):
    plans = []
    for seq in cfg["sequences"]:
        plans.append({"name": f"gas/{seq}", "vehicle": "gas", "sequence": seq})
        plans.append({"name": f"ev/{seq}/default", "vehicle": "ev", "sequence": seq})
        for s in cfg["stops"]:
            if s.get("site_charger") and s["id"] in cfg["sequences"][seq]:
                plans.append({"name": f"ev/{seq}/opp@{s['id']}", "vehicle": "ev", "sequence": seq,
                              "charges": [{"at": s["id"], "target": "finish"}]})
        sites = [s["id"] for s in cfg["stops"] if s.get("site_charger") and s["id"] in cfg["sequences"][seq]]
        for sid in sites:
            plans.append({"name": f"ev/{seq}/opp@{sid}(unload)", "vehicle": "ev", "sequence": seq,
                          "charges": [{"at": sid, "target": "unload_only"}]})
        for a_, b_ in itertools.permutations(sites, 2):
            if cfg["sequences"][seq].index(a_) < cfg["sequences"][seq].index(b_):
                plans.append({"name": f"ev/{seq}/opp@{a_}(unload)+{b_}", "vehicle": "ev", "sequence": seq,
                              "charges": [{"at": a_, "target": "unload_only"}, {"at": b_, "target": "finish"}]})
        for c in cfg.get("chargers", []):
            if c["type"] == "public":
                for after in cfg["sequences"][seq]:
                    plans.append({"name": f"ev/{seq}/{c['id']}after{after}", "vehicle": "ev", "sequence": seq,
                                  "charges": [{"at": c["id"], "after": after}]})
    return plans


def anchors(cfg, events=None):
    rows = []
    for p in plan_menu(cfg):
        r = simulate(cfg, p, events)
        if r["stranded"]:
            continue
        rows.append((p["name"], r))
    tol = cfg["contract_tolerance"]
    best_ot = max(r["on_time_pct"] for _, r in rows)
    best_cost = min(r["total_cost"] for _, r in rows)
    best_h = min(r["cycle_h"] for _, r in rows)
    best_g = min(r["ghg_kg"] for _, r in rows)
    worst_g = max(r["ghg_kg"] for n, r in rows if n.startswith("gas/"))
    return {
        "on_time_pct": {"best": best_ot, "worst": tol["on_time_floor_pct"]},
        "total_cost": {"best": best_cost, "worst": round(best_cost * (1 + tol["cost_over_best_pct"] / 100), 2)},
        "cycle_h": {"best": best_h, "worst": round(best_h + tol["cycle_over_best_h"], 2)},
        "ghg_kg": {"best": best_g, "worst": worst_g},
    }, rows


if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1]))
    if sys.argv[2] == "--anchors":
        a, rows = anchors(cfg)
        print(json.dumps(a, indent=2))
    else:
        plan = json.load(open(sys.argv[2]))
        r = simulate(cfg, plan, cfg.get("events_applied"))
        sc, idx = scorecard(cfg, r)
        r.pop("_end_min")
        print(json.dumps({"result": r, "scorecard": sc, "index": idx}, indent=2))
