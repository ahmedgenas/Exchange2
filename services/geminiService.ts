
import { GoogleGenAI } from "@google/genai";
import { TransferRequest, Product, Branch } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAdminInsights = async (
  requests: TransferRequest[],
  products: Product[],
  branches: Branch[]
): Promise<string> => {
  try {
    // Prepare data summary for the model
    const requestSummary = requests.map(r => {
      const product = products.find(p => p.code === r.productCode)?.name || r.productCode;
      const from = branches.find(b => b.id === r.targetBranchId)?.name || 'Unknown';
      const to = branches.find(b => b.id === r.requesterBranchId)?.name || 'Unknown';
      return `Request ID: ${r.id}, Product: ${product}, From Branch: ${from}, To Branch: ${to}, Status: ${r.status}, Rejection Reason: ${r.rejectionReason || 'N/A'}`;
    }).join('\n');

    const prompt = `
      You are an AI analyst for TAY GROUP Pharmacies.
      Analyze the following transfer request logs and provide a brief executive summary (in Arabic).
      
      CRITICAL ANALYSIS REQUIRED:
      1. **Missed Opportunities (Expired Requests):** Identify branches that failed to respond within 30 minutes (Status: EXPIRED). This indicates operational negligence.
      2. **Rejected Requests:** Identify branches that frequently REJECT requests and the common reasons provided.
      3. **Supply Chain:** Most transferred items (high demand) and branches with frequent shortages.
      
      Data:
      ${requestSummary}
      
      Format the response as a clean HTML string (using <ul>, <li>, <strong>, <span style="color:red"> for alerts). Do not use Markdown code blocks.
      Make sure to highlight specific branch names that are causing delays (Expired) or rejections.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "لا توجد بيانات كافية للتحليل.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "حدث خطأ أثناء جلب التحليلات الذكية. يرجى التحقق من مفتاح API.";
  }
};
