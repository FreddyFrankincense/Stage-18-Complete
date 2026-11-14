import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasValidGeminiKey = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.length > 10);
    res.json({
      status: 'ok',
      server: 'Stage 18 Express + Vite Workbench Server',
      nodeVersion: process.version,
      geminiCloudConfigured: hasValidGeminiKey,
      fallbackEngineReady: true,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/analyze-frame-architecture', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured on the server. Switching to Local CV Geometric Solver Backup.',
          code: 'GEMINI_KEY_UNAVAILABLE'
        });
        return;
      }

      const {
        imageBase64,
        mimeType = 'image/png',
        frameTitle = 'Stage 18 Reference Frame',
        smpteTimecode = '00:02:14:08',
        focalLengthMm = 35,
        targetApartmentHint = 'apt-thorwald',
        cvPrepassTelemetry,
        currentParametricState
      } = req.body || {};

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const promptText = `Analyze this frame from Alfred Hitchcock's Rear Window (1954) Paramount Stage 18 courtyard set for 3D architectural reconstruction in Blender 4.2 LTS.

CRITICAL HOLLYWOOD SOUNDSTAGE CARPENTRY & FORCED-PERSPECTIVE LAW (DO NOT ASSUME ARCHITECTURAL STANDARDS):
- Published archival blueprints and standard NYC municipal building codes are INACCURATE for Paramount Stage 18.
- Production designers Hal Pereira and J. McMillan Johnson built the entire set inside a constrained 185' x 98' x 40' soundstage strictly to appear accurate from L.B. Jefferies's 2nd-floor camera POV (nodal origin X=0, Y=+14.5', Z=+18.2').
- Rooms and facades furthest from the camera were physically built at compressed depths (0.66x to 0.88x forced-perspective scale), with undersized brick courses (2.1" to 2.4" vertical pitch on distant walls instead of standard 2.667"), non-orthogonal trapezoidal side walls splayed open toward Jeffries's sightline (+6.5 deg to +14.5 deg cameraSightlineSplayDeg) so window jambs do not block the camera's oblique view, and raked floors/ceilings (-3.2 deg to +4.8 deg floorRakePitchDeg).

Frame Context:
- Title: ${frameTitle}
- SMPTE Timecode: ${smpteTimecode}
- Camera Focal Length: ${focalLengthMm}mm (Mitchell BNC 1.66:1 or Exakta VX SLR)
- Initial Target Zone Hint: ${targetApartmentHint}
- Client Computer-Vision Pre-Pass Telemetry: ${JSON.stringify(cvPrepassTelemetry || {})}
- Current Parametric 3D Dimensions for Target Zone: ${JSON.stringify(currentParametricState || {})}

Valid Stage 18 targetApartmentId values & Radial Distance from Jeffries's Camera:
- "apt-jeffries" (APT 2B · L.B. Jefferies's Foreground Apartment, d=0 ft Nodal Anchor, 1.00x scale, 0 deg splay)
- "apt-torso" (APT 2D · Miss Torso's Ballet Studio, West Wing, d=33.4 ft oblique, ~0.88x scale, +11.5 deg wall splay)
- "apt-composer" (APT 3A · The Songwriter's Penthouse Studio, East Wing, d=35.1 ft oblique, ~0.85x scale, -12.0 deg wall splay, +3.5 deg floor rake)
- "apt-sculptor" (APT 1A · Excavated Basement Garden & Patio, d=39.4 ft, ~0.92x scale, +4.2 deg trapezoidal taper)
- "apt-lonelyhearts" (APT 1C · Miss Lonelyhearts's Ground Apartment, West Wing, d=40.4 ft, ~0.86x scale, +9.5 deg wall splay, -3.2 deg rake)
- "apt-thorwald" (APT 2E · Lars Thorwald's 4-Room Railroad Flat, North Wing, d=43.6 ft, ~0.82x scale, +6.8 deg wall splay, 11.4 ft physical depth vs 16.5 ft apparent depth)
- "apt-alley-street" (NORTH ALLEY · Cross-Street & Bar Marquee, Farthest Zone d=55.4 ft, ~0.66x forced-perspective scale, +14.5 deg converging alley splay, +4.8 deg raked street ramp, 5.2 ft physical depth vs 35.0 ft apparent depth)

Based on the visual evidence, radial distance from Jeffries's camera, and CV pre-pass telemetry, provide refined 3D physical soundstage dimensions (accounting for POV forced-perspective compression and non-orthogonal wall/floor angles).`;

      const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [];

      if (imageBase64 && typeof imageBase64 === 'string') {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        if (cleanBase64.length > 64) {
          parts.push({
            inlineData: {
              mimeType,
              data: cleanBase64
            }
          });
        }
      }
      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are a senior motion-picture set photogrammetrist and Blender 4.2 technical director reconstructing the 1954 Paramount Stage 18 Rear Window courtyard set. Always account for Hal Pereira\'s camera-POV forced-perspective compression, non-orthogonal trapezoidal wall splay angles, and raked floors rather than assuming standard 90-degree architectural building codes. Output strictly valid JSON matching the requested schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              targetApartmentId: {
                type: Type.STRING,
                description:
                  'One of: apt-thorwald, apt-torso, apt-composer, apt-lonelyhearts, apt-sculptor, apt-alley-street, apt-jeffries'
              },
              confidenceScore: {
                type: Type.INTEGER,
                description: 'Reconstruction confidence score from 65 to 98 based on frame clarity'
              },
              widthFeet: {
                type: Type.NUMBER,
                description: 'Physical soundstage facade or zone width in feet (POV-compensated)'
              },
              heightFeet: {
                type: Type.NUMBER,
                description: 'Physical soundstage building or zone height in feet (POV-compensated)'
              },
              depthFeet: {
                type: Type.NUMBER,
                description: 'Physical soundstage structural massing depth in feet'
              },
              elevationOffsetFeet: {
                type: Type.NUMBER,
                description: 'Vertical floor elevation in feet relative to courtyard datum'
              },
              windowCols: {
                type: Type.INTEGER,
                description: 'Horizontal window bay columns counted across facade'
              },
              windowRows: {
                type: Type.INTEGER,
                description: 'Vertical window stories/rows counted on facade'
              },
              windowRevealInches: {
                type: Type.NUMBER,
                description: 'Physical recessed masonry window reveal depth in inches (scaled down on distant facades, 4.0 to 9.5)'
              },
              balconyProjectionFeet: {
                type: Type.NUMBER,
                description: 'Fire escape landing or Juliette iron balcony projection in feet'
              },
              interiorDepthFeet: {
                type: Type.NUMBER,
                description: 'True compressed Stage 18 physical carpentry depth of the room in feet (shallower for rooms farther from Jeffs camera)'
              },
              apparentArchitecturalDepthFeet: {
                type: Type.NUMBER,
                description: 'Apparent optical depth in feet if naively assuming 1:1 orthogonal architectural standards'
              },
              forcedPerspectiveScaleFactor: {
                type: Type.NUMBER,
                description: 'Physical set construction scale factor relative to 1:1 foreground (1.00 at Jeffries down to 0.66 at North Alley)'
              },
              cameraSightlineSplayDeg: {
                type: Type.NUMBER,
                description: 'Non-orthogonal horizontal wall splay angle in degrees cheated toward Jeffries camera POV (-15.0 to +16.0)'
              },
              floorRakePitchDeg: {
                type: Type.NUMBER,
                description: 'Vertical floor/ceiling rake pitch in degrees built to cheat depth from Jeffries +14.5ft elevation (-5.0 to +6.0)'
              },
              spatialReasoningSummary: {
                type: Type.STRING,
                description:
                  'Concise 1-2 sentence photogrammetric derivation explaining how camera-POV forced perspective, wall splay, and distance attenuation were applied instead of standard architectural assumptions.'
              },
              detectedFeatures: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                },
                description:
                  '3 to 4 specific POV-compensated set carpentry features measured in the frame (e.g., compressed brick gauge, splayed side walls, raked floor, shallow shadowbox depth).'
              }
            },
            required: [
              'targetApartmentId',
              'confidenceScore',
              'widthFeet',
              'heightFeet',
              'depthFeet',
              'elevationOffsetFeet',
              'windowCols',
              'windowRows',
              'windowRevealInches',
              'balconyProjectionFeet',
              'interiorDepthFeet',
              'apparentArchitecturalDepthFeet',
              'forcedPerspectiveScaleFactor',
              'cameraSightlineSplayDeg',
              'floorRakePitchDeg',
              'spatialReasoningSummary',
              'detectedFeatures'
            ]
          }
        }
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({
        engine: 'gemini_cloud_hybrid',
        model: 'gemini-4-hydrogen',
        analysis: parsed
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: errMsg,
        code: 'GEMINI_ANALYSIS_ERROR'
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stage 18 Workbench Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
