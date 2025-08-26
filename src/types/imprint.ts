export interface ImprintFile {
  id: string;
  name: string;
  url: string;
  type: string;
  category: 'customerArt' | 'productionFiles' | 'proofMockup';
}

export interface ImprintItem {
  id: string;
  method: string;
  location: string;
  width: number;
  height: number;
  colorsOrThreads: string;
  notes: string;
  customerArt: ImprintFile[];
  productionFiles: ImprintFile[];
  proofMockup: ImprintFile[];
  stageDurations?: Record<string, number>;
}

export interface ImprintMethod {
  value: string;
  label: string;
  customerArtTypes: string[];
  productionFileTypes: string[];
  instructions: string;
  requirements?: string[];
}

export const IMPRINT_METHODS: ImprintMethod[] = [
  {
    value: "screenPrinting",
    label: "Screen Printing",
    customerArtTypes: ["jpg", "png", "pdf", "ai", "eps"],
    productionFileTypes: ["ai", "eps", "pdf", "psd", "zip"],
    instructions: "Vector spot colors or PSD with spot-color channels. Include underbase if needed.",
    requirements: ["Vector files preferred", "Spot color separations", "Include underbase for dark garments"]
  },
  {
    value: "general",
    label: "General",
    customerArtTypes: ["jpg", "png", "pdf"],
    productionFileTypes: ["pdf", "zip"],
    instructions: "Generic imprint method for custom workflows.",
    requirements: ["Provide final artwork", "Specify sizing and placement"]
  },
  {
    value: "embroidery",
    label: "Embroidery", 
    customerArtTypes: ["jpg", "png", "pdf", "ai", "eps"],
    productionFileTypes: ["emb", "pxf", "ofm", "dst", "exp", "pes", "jef", "vp3"],
    instructions: "Native embroidery files (emb, pxf, ofm) or stitch files (dst, exp). Include thread chart if available.",
    requirements: ["Stitch files required", "Thread chart recommended", "Consider stitch density"]
  },
  {
    value: "dtf",
    label: "DTF",
    customerArtTypes: ["png", "tiff", "pdf"],
    productionFileTypes: ["png", "tiff", "pdf"],
    instructions: "PNG or TIFF with transparency at size. Optional gang sheet PDF.",
    requirements: ["Transparency required", "Final print size", "Gang sheet layout optional"]
  },
  {
    value: "dtg",
    label: "DTG",
    customerArtTypes: ["png", "tiff", "psd"],
    productionFileTypes: ["png", "tiff", "psd"],
    instructions: "PNG or TIFF with transparency at print size. RGB, sRGB color space.",
    requirements: ["Transparency required", "Print size resolution", "RGB color space"]
  }
];

export function getMethodConfig(methodValue: string): ImprintMethod | undefined {
  return IMPRINT_METHODS.find(method => method.value === methodValue);
}