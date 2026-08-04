import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'Hello',
    });
    console.log("gemini-1.5-flash:", res.text);
  } catch (e: any) {
    console.error("gemini-1.5-flash err:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Hello',
    });
    console.log("gemini-2.0-flash:", res.text);
  } catch (e: any) {
    console.error("gemini-2.0-flash err:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    console.log("gemini-2.5-flash:", res.text);
  } catch (e: any) {
    console.error("gemini-2.5-flash err:", e.message);
  }
}
run();
