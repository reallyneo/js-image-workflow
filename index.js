const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const STORAGE = path.resolve(__dirname, 'storage');
const INPUT = path.join(STORAGE, 'input');
const OUTPUT = path.join(STORAGE, 'output');
[STORAGE, INPUT, OUTPUT].forEach(p => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true }));

const upload = multer({ dest: INPUT });
const app = express();
app.use(express.json());

const JOBS = {}; // in-memory job store

// Steps: resize, rotate, crop, blur, convert, watermark, save
async function applySteps(inputPath, outPath, steps) {
  let pipeline = sharp(inputPath);
  let metadata = await pipeline.metadata(); // get image dimensions

  for (let step of steps) {
    const name = step.name;
    const params = step.params || {};

    switch (name) {
      case 'resize':
        pipeline = pipeline.resize(params.width || null, params.height || null);
        metadata = await pipeline.metadata(); // update metadata if resized
        break;

      case 'rotate':
        pipeline = pipeline.rotate(params.angle || 0);
        break;

      case 'crop':
        pipeline = pipeline.extract({
          left: params.left || 0,
          top: params.top || 0,
          width: params.width || metadata.width,
          height: params.height || metadata.height
        });
        metadata = await pipeline.metadata();
        break;

      case 'blur':
        pipeline = pipeline.blur(params.sigma || 1.0);
        break;

      case 'convert':
        pipeline = pipeline.toFormat(params.format || 'png', { quality: params.quality || 80 });
        break;

      case 'watermark':
        const text = params.text || '';
        const fontSize = params.size || 24;

        // Create SVG dynamically based on image size
        const svgWidth = metadata.width;
        const svgHeight = metadata.height;

        const svg = `<svg width="${svgWidth}" height="${svgHeight}">
          <style>
            .t { fill: ${params.color || 'white'}; font-size: ${fontSize}px; font-family: Arial; opacity: ${params.opacity || 0.6} }
          </style>
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="t">${text}</text>
        </svg>`;

        pipeline = pipeline.composite([{ input: Buffer.from(svg), gravity: 'southeast' }]);
        break;

      case 'save':
        const fmt = (params.format || 'png').toLowerCase();
        if (fmt === 'jpeg' || fmt === 'jpg') pipeline = pipeline.jpeg({ quality: params.quality || 80 });
        else if (fmt === 'webp') pipeline = pipeline.webp({ quality: params.quality || 80 });
        else pipeline = pipeline.png({ quality: params.quality || 80 });
        break;

      default:
        throw new Error(`Unknown step ${name}`);
    }
  }

  await pipeline.toFile(outPath);
}

app.post('/submit', upload.single('file'), async (req, res) => {
  try {
    const jobId = uuidv4().slice(0,8);
    const spec = req.body.spec ? JSON.parse(req.body.spec) : null;
    if (!spec || !spec.steps) return res.status(400).send({error:"spec missing"});
    const inPath = req.file.path;
    const outPath = path.join(OUTPUT, `${path.parse(req.file.originalname).name}_${jobId}.png`);
    JOBS[jobId] = { status: 'queued', input: inPath, output: outPath };
    // process asynchronously (fire-and-forget okay for this example)
    (async () => {
      try {
        JOBS[jobId].status = 'running';
        await applySteps(inPath, outPath, spec.steps);
        JOBS[jobId].status = 'finished';
      } catch (err) {
        JOBS[jobId].status = 'error';
        JOBS[jobId].error = err.message;
      }
    })();
    res.json({ jobId });
  } catch (err) {
    res.status(500).send({error: err.message});
  }
});

app.get('/status/:id', (req,res) => {
  const job = JOBS[req.params.id];
  if (!job) return res.status(404).send({error:"not found"});
  res.json(job);
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
