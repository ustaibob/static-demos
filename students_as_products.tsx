import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Factory, Truck, BarChart, RefreshCw, Settings } from 'lucide-react';

const TalentSCORProductModel = () => {
  const [expandedSections, setExpandedSections] = useState({
    plan: true,
    source: false,
    make: false,
    deliver: false,
    return: false,
    enable: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const scorProcesses = {
    plan: {
      title: "Plan (sP)",
      subtitle: "Workforce Production Planning",
      icon: BarChart,
      color: "bg-blue-50 border-blue-200",
      headerColor: "bg-blue-100",
      entities: [
        {
          name: "Labor Market Forecast",
          attributes: ["forecastId", "targetIndustry", "requiredRoles", "demandVolume", "timeHorizon", "skillRequirements", "compensationBands"],
          description: "Demand signal from employer-customers driving production planning"
        },
        {
          name: "Cohort Production Plan",
          attributes: ["planId", "institutionId", "targetGraduates", "programMix", "capacityAllocation", "qualityTargets", "budgetAllocation"],
          description: "Master production schedule for talent manufacturing"
        },
        {
          name: "Curriculum Design",
          attributes: ["curriculumId", "targetCompetencies", "BOM_courses", "sequencing", "totalCredits", "expectedYield", "QA_standards"],
          description: "Bill of Materials (BOM) for student product configuration"
        },
        {
          name: "Admissions Target",
          attributes: ["targetId", "cohortSize", "selectivityRate", "diversityGoals", "yieldAssumptions", "preparednessThresholds"],
          description: "Raw material intake planning and specifications"
        }
      ]
    },
    source: {
      title: "Source (sS)",
      subtitle: "Raw Material Acquisition (Student Recruitment)",
      icon: Users,
      color: "bg-green-50 border-green-200",
      headerColor: "bg-green-100",
      entities: [
        {
          name: "Prospect Pool",
          attributes: ["poolId", "demographics", "geographicSource", "academicProfile", "psychometricData", "engagementLevel"],
          description: "Available raw material supply base"
        },
        {
          name: "Recruitment Campaign",
          attributes: ["campaignId", "institutionId", "targetSegments", "channels", "conversionMetrics", "costPerAcquisition"],
          description: "Supplier relationship and procurement activities"
        },
        {
          name: "Admitted Student",
          attributes: ["admissionId", "studentId", "rawCapabilities", "developmentPotential", "financialCommitment", "enrollmentProbability"],
          description: "Procured raw material awaiting processing"
        },
        {
          name: "Enrolled Student (Raw Material)",
          attributes: ["enrollmentId", "studentId", "programId", "startingCompetencies", "baselineAssessment", "developmentPlan"],
          description: "Raw material entered into production system"
        }
      ]
    },
    make: {
      title: "Make (sM)",
      subtitle: "Student Manufacturing/Transformation",
      icon: Factory,
      color: "bg-purple-50 border-purple-200",
      headerColor: "bg-purple-100",
      entities: [
        {
          name: "Student Work-in-Progress",
          attributes: ["wipId", "studentId", "currentYear", "creditsCompleted", "GPA", "competenciesAcquired", "deficiencies", "timeToCompletion"],
          description: "Student in various stages of production/transformation"
        },
        {
          name: "Educational Workstation",
          attributes: ["workstationId", "type", "faculty", "capacity", "throughput", "qualityMetrics", "utilization"],
          description: "Production line stations (classrooms, labs, studios, cohorts)"
        },
        {
          name: "Instructional Process",
          attributes: ["processId", "courseId", "instructorId", "students", "pedagogyType", "cycleTime", "passRate", "valueAdd"],
          description: "Manufacturing process/operations applied to WIP students"
        },
        {
          name: "Quality Control Event",
          attributes: ["qcId", "studentId", "assessmentType", "standards", "results", "conformance", "remediationRequired"],
          description: "In-process quality inspections and testing"
        },
        {
          name: "Capstone Project",
          attributes: ["projectId", "studentId", "complexity", "industrySponsorship", "outcomes", "competencyDemonstration"],
          description: "Final assembly and integration testing"
        },
        {
          name: "Graduate (Finished Good)",
          attributes: ["graduateId", "studentId", "degree", "specialization", "competencyBundle", "certifications", "portfolioQuality", "graduationDate"],
          description: "Completed product ready for market delivery"
        }
      ]
    },
    deliver: {
      title: "Deliver (sD)",
      subtitle: "Graduate Distribution & Placement",
      icon: Truck,
      color: "bg-orange-50 border-orange-200",
      headerColor: "bg-orange-100",
      entities: [
        {
          name: "Employer Customer",
          attributes: ["employerId", "companyName", "industry", "hiringVolume", "qualityRequirements", "compensationBudget", "locationPreferences"],
          description: "End customer receiving finished talent products"
        },
        {
          name: "Job Requisition (Customer Order)",
          attributes: ["requisitionId", "employerId", "roleSpec", "quantity", "competencyRequirements", "urgency", "compensationOffer"],
          description: "Customer purchase order for talent products"
        },
        {
          name: "Career Services Channel",
          attributes: ["channelId", "institutionId", "channelType", "employerNetwork", "placementRate", "avgTimeToPlacement"],
          description: "Distribution channel and logistics network"
        },
        {
          name: "Placement Transaction",
          attributes: ["placementId", "graduateId", "employerId", "role", "compensation", "startDate", "matchScore", "institutionFee"],
          description: "Order fulfillment - delivery of finished product to customer"
        },
        {
          name: "Alumni Inventory",
          attributes: ["alumniId", "graduateId", "currentEmployer", "roleProgression", "marketValue", "availability", "lifetimeValue"],
          description: "Finished goods in the field - deployed product base"
        },
        {
          name: "Placement Performance",
          attributes: ["performanceId", "placementId", "employerSatisfaction", "graduatePerformance", "retentionRate", "promotionVelocity"],
          description: "Post-delivery product performance metrics"
        }
      ]
    },
    return: {
      title: "Return (sR)",
      subtitle: "Returns, Recalls & Continuous Improvement",
      icon: RefreshCw,
      color: "bg-red-50 border-red-200",
      headerColor: "bg-red-100",
      entities: [
        {
          name: "Student Attrition",
          attributes: ["attritionId", "studentId", "exitStage", "rootCause", "financialImpact", "scrapValue", "preventionOpportunities"],
          description: "Manufacturing defects/scrap - students who don't complete"
        },
        {
          name: "Employer Feedback",
          attributes: ["feedbackId", "placementId", "employerId", "skillGaps", "preparednessRating", "culturalFit", "improvementRequests"],
          description: "Customer complaints and product quality issues"
        },
        {
          name: "Graduate Upskilling",
          attributes: ["upskillingId", "alumniId", "skillDeficiency", "remediationCourse", "institutionLiability", "warrantyStatus"],
          description: "Product recalls and rework for quality issues"
        },
        {
          name: "Curriculum Revision",
          attributes: ["revisionId", "curriculumId", "triggeredBy", "changes", "expectedImprovement", "implementationDate"],
          description: "Process improvement based on return data"
        },
        {
          name: "Alumni Re-engagement",
          attributes: ["reengagementId", "alumniId", "serviceType", "revenueGenerated", "competencyRefresh", "networkValue"],
          description: "After-market services and customer retention"
        }
      ]
    },
    enable: {
      title: "Enable (sE)",
      subtitle: "Manufacturing Support Infrastructure",
      icon: Settings,
      color: "bg-gray-50 border-gray-200",
      headerColor: "bg-gray-100",
      entities: [
        {
          name: "Educational Institution",
          attributes: ["institutionId", "name", "accreditation", "productionCapacity", "facultyCount", "facilities", "brandReputation", "financialHealth"],
          description: "Manufacturing facility/plant entity"
        },
        {
          name: "Faculty Resource",
          attributes: ["facultyId", "name", "specialization", "capacity", "quality_rating", "cost", "utilization"],
          description: "Human capital in the production system"
        },
        {
          name: "Facility & Equipment",
          attributes: ["assetId", "assetType", "capacity", "condition", "maintenanceSchedule", "utilizationRate"],
          description: "Production equipment and infrastructure"
        },
        {
          name: "Financial Aid Program",
          attributes: ["programId", "fundingSource", "eligibilityRules", "amountAvailable", "recipientCount", "defaultRate"],
          description: "Customer financing supporting market demand"
        },
        {
          name: "Accreditation & Compliance",
          attributes: ["complianceId", "regulatoryBody", "standards", "auditSchedule", "certificationStatus", "risksIdentified"],
          description: "Quality management system and regulatory compliance"
        },
        {
          name: "Supply Chain Analytics",
          attributes: ["analyticsId", "institutionId", "KPIs", "throughputTime", "yieldRate", "defectRate", "inventoryTurns", "COGS_perStudent"],
          description: "Performance measurement and optimization systems"
        },
        {
          name: "Employer Relationship Mgmt",
          attributes: ["relationshipId", "employerId", "engagementLevel", "hiringHistory", "feedbackLoop", "partnershipPrograms"],
          description: "Customer relationship management"
        }
      ]
    }
  };

  const SectionHeader = ({ section, data }) => {
    const Icon = data.icon;
    return (
      <div 
        className={`${data.headerColor} border ${data.color.split(' ')[1]} p-4 cursor-pointer flex items-center justify-between`}
        onClick={() => toggleSection(section)}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6" />
          <div>
            <h3 className="font-bold text-lg">{data.title}</h3>
            <p className="text-sm text-gray-600">{data.subtitle}</p>
          </div>
        </div>
        {expandedSections[section] ? <ChevronDown /> : <ChevronRight />}
      </div>
    );
  };

  const EntityCard = ({ entity }) => (
    <div className="bg-white border border-gray-300 rounded p-4 mb-3">
      <h4 className="font-semibold text-md mb-2">{entity.name}</h4>
      <p className="text-sm text-gray-600 mb-3 italic">{entity.description}</p>
      <div className="bg-gray-50 p-2 rounded">
        <p className="text-xs font-semibold mb-1">Attributes:</p>
        <div className="flex flex-wrap gap-1">
          {entity.attributes.map((attr, idx) => (
            <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
              {attr}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Talent Development Supply Chain</h1>
        <h2 className="text-xl text-gray-600 mb-4">SCOR Model: Students as Products</h2>
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm mb-3">
            <strong>Framework:</strong> This domain model applies the APICS ASCM SCOR framework to talent development, 
            treating <strong>students as products</strong> that are manufactured by educational institutions 
            and delivered to employer-customers in the labor market.
          </p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>Raw Materials:</strong> Prospective/admitted students<br/>
              <strong>WIP:</strong> Enrolled students in various stages<br/>
              <strong>Finished Goods:</strong> Graduates ready for placement
            </div>
            <div>
              <strong>Manufacturers:</strong> Educational institutions<br/>
              <strong>Customers:</strong> Employers hiring graduates<br/>
              <strong>Distribution:</strong> Career services & placement
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(scorProcesses).map(([key, data]) => (
          <div key={key} className={`border rounded ${data.color}`}>
            <SectionHeader section={key} data={data} />
            {expandedSections[key] && (
              <div className="p-4">
                {data.entities.map((entity, idx) => (
                  <EntityCard key={idx} entity={entity} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded p-4">
        <h3 className="font-bold mb-2">Key Supply Chain Metrics</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Manufacturing Metrics:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Cycle Time: Time from admission to graduation</li>
              <li>• Throughput: Graduates per academic year</li>
              <li>• Yield Rate: % of admitted students who graduate</li>
              <li>• Defect Rate: Attrition percentage</li>
              <li>• COGS: Cost per graduate produced</li>
            </ul>
          </div>
          <div>
            <strong>Delivery Metrics:</strong>
            <ul className="mt-1 space-y-1">
              <li>• On-time Delivery: % placed within 6 months</li>
              <li>• Fill Rate: % of employer requisitions filled</li>
              <li>• Perfect Order: Placement matching all specs</li>
              <li>• Customer Satisfaction: Employer ratings</li>
              <li>• Return Rate: % requiring upskilling</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-4">
        <h3 className="font-bold mb-2">Paradigm Comparison</h3>
        <p className="text-sm">
          <strong>Students as Consumers:</strong> Focuses on student experience, choice, and outcomes optimization from the learner's perspective.
          Students are active decision-makers navigating the system.
        </p>
        <p className="text-sm mt-2">
          <strong>Students as Products:</strong> Focuses on institutional operations, quality control, and labor market alignment. 
          Educational institutions are manufacturers optimizing production efficiency and product-market fit.
        </p>
      </div>
    </div>
  );
};

export default TalentSCORProductModel;