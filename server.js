import express from 'express';
import cors from 'cors';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { analyzeComplaint } from './gemini.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const prisma = new PrismaClient();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Route 1: GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Route 2: GET /api/complaints
  app.get('/api/complaints', async (req, res) => {
    try {
      const complaints = await prisma.complaint.findMany({
        include: {
          aiVerdict: true,
        },
        orderBy: {
          submitted_at_iso: 'desc',
        },
        take: 100, // Limiting since we only expect ~30
      });
      res.json(complaints);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch complaints' });
    }
  });

  // Route 3: POST /api/analyze
  app.post('/api/analyze', async (req, res) => {
    const { issue_code } = req.body;
    if (!issue_code) {
      return res.status(400).json({ error: 'issue_code is required' });
    }

    try {
      const complaint = await prisma.complaint.findUnique({
        where: { issue_code },
        include: { aiVerdict: true },
      });

      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      if (complaint.aiVerdict) {
        // Return cached verdict
        return res.json(complaint.aiVerdict);
      }

      // Call Gemini
      const aiResult = await analyzeComplaint(complaint);

      // Save to DB
      const newVerdict = await prisma.aiVerdict.create({
        data: {
          complaintId: complaint.id,
          verdict: aiResult.verdict,
          is_bs: aiResult.is_bs,
          confidence_score: aiResult.confidence_score,
          red_flags: JSON.stringify(aiResult.red_flags || []),
          explanation: aiResult.explanation,
        },
      });

      res.json(newVerdict);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'AI analysis failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    // Import Vite here to avoid breaking production deployments where Vite might not be present
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
