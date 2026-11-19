import axios from 'axios';

const LUV_SMM_API_KEY = process.env.LUV_SMM_API_KEY || '';
const LUV_SMM_API_URL = process.env.LUV_SMM_API_URL || 'https://luvsmm.com/api/v2';

export async function syncServices() {
  if (!LUV_SMM_API_KEY) {
    console.warn("LUV_SMM_API_KEY not set. Skipping service sync.");
    return [];
  }
  try {
    const res = await axios.post(LUV_SMM_API_URL, {
      key: LUV_SMM_API_KEY,
      action: 'services'
    });
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch (err) {
    console.error("Failed to sync services from LuvSMM:", err.message);
    return [];
  }
}

export async function placeExternalOrder(serviceId, targetUrl, quantity) {
  if (!LUV_SMM_API_KEY) {
    throw new Error("Provider API key not configured.");
  }
  try {
    const res = await axios.post(LUV_SMM_API_URL, {
      key: LUV_SMM_API_KEY,
      action: 'add',
      service: serviceId,
      link: targetUrl,
      quantity: quantity
    });
    if (res.data && res.data.order) {
      return { externalOrderId: String(res.data.order) };
    }
    throw new Error(res.data.error || "Failed to place order with provider.");
  } catch (err) {
    console.error("LuvSMM Order Error:", err.message);
    throw err;
  }
}

