// Centralized list of industries used across the app
// Keep names alphabetized; preserve existing IDs where present

export type IndustryOption = {
  id: string;
  name: string;
};

export const INDUSTRIES: IndustryOption[] = [
  { id: "accounting_finance", name: "Accounting & Finance" },
  { id: "advertising_marketing", name: "Advertising & Marketing" },
  { id: "agriculture", name: "Agriculture" },
  { id: "automotive", name: "Automotive" },
  { id: "construction", name: "Construction" },
  { id: "consulting", name: "Consulting" },
  { id: "consumer_goods", name: "Consumer Goods" },
  { id: "education", name: "Education" }, // existing
  { id: "ecommerce", name: "Ecommerce" }, // existing
  { id: "energy_utilities", name: "Energy & Utilities" },
  { id: "entertainment", name: "Entertainment" },
  { id: "financial_services", name: "Financial Services" },
  { id: "food_beverage", name: "Food & Beverage" },
  { id: "government", name: "Government" },
  { id: "healthcare", name: "Healthcare" }, // existing
  { id: "hospitality", name: "Hospitality" },
  { id: "insurance", name: "Insurance" },
  { id: "legal", name: "Legal" },
  { id: "logistics_supply_chain", name: "Logistics & Supply Chain" },
  { id: "manufacturing", name: "Manufacturing" }, // existing
  { id: "media_publishing", name: "Media & Publishing" },
  { id: "nonprofit", name: "Nonprofit" },
  { id: "pharmaceuticals_biotech", name: "Pharmaceuticals & Biotech" },
  { id: "professional_services", name: "Professional Services" },
  { id: "real_estate", name: "Real Estate" },
  { id: "retail", name: "Retail" }, // existing
  { id: "sports_recreation", name: "Sports & Recreation" },
  { id: "tech", name: "Technology" }, // existing
  { id: "telecommunications", name: "Telecommunications" },
  { id: "transportation", name: "Transportation" },
  { id: "travel_tourism", name: "Travel & Tourism" },
  { id: "wholesale_distribution", name: "Wholesale & Distribution" },
  { id: "other", name: "Other" },
];

export function getIndustryNameFromId(industryId: string): string {
  const match = INDUSTRIES.find((i) => i.id === industryId);
  return match ? match.name : industryId;
}


