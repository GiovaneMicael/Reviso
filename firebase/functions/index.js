const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

admin.initializeApp();
const geminiKey = defineSecret('GEMINI_API_KEY');

exports.processarRedacao = onDocumentCreated({ document: 'usuarios/{uid}/redacoes/{redacaoId}', secrets: [geminiKey], timeoutSeconds: 120, region: 'southamerica-east1' }, async (event) => {
  const snap = event.data;
  const data = snap.data();
  if (!data || data.status !== 'processando') return;
  const genAI = new GoogleGenerativeAI(geminiKey.value());
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
  const prompt = `Corrija conforme as cinco competências do ENEM. Retorne JSON estruturado com competencias, repertorio, intervencao, diagnostico_geral e lacunas_prioritarias. Tema: ${data.tema || 'não informado'}\n\n${data.texto}`;
  try {
    const response = await model.generateContent(prompt);
    const result = JSON.parse(response.response.text());
    await snap.ref.update({ ...result, nota_total: result.competencias.reduce((sum, item) => sum + item.nota, 0), status: 'concluido', processed_at: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) {
    await snap.ref.update({ status: 'erro', error: error.message, processed_at: admin.firestore.FieldValue.serverTimestamp() });
  }
});
