JS Image Processing Workflow

A simple Node.js image processing server that allows you to upload images and apply customizable transformations, including resizing, rotating, cropping, blurring, converting formats, and adding watermarks. Jobs are processed asynchronously, with job status tracking.

Features

Upload images via HTTP POST.

Define image processing steps in JSON (spec) per job.

Supports:

Resize

Rotate

Crop

Blur

Convert formats (PNG, JPEG, WebP)

Watermark with dynamic sizing

Save output

Asynchronous processing with job IDs.

Check job status via GET request.

Installation
git clone <your-repo-url>
cd js_project
npm install

Usage
Start the server
node index.js


Or, with auto-reload using nodemon:

npx nodemon index.js

Replace "pic.jpeg" with your file name to submit a new job:

curl -X POST http://localhost:3000/submit \
  -F "file=@pic.jpeg" \
  -F "spec={\"steps\":[
    {\"name\":\"watermark\",\"params\":{\"text\":\"MyJSWorkflow\",\"size\":36,\"color\":\"white\",\"opacity\":0.5}},
    {\"name\":\"save\",\"params\":{\"format\":\"png\"}}
  ]}"


Response:

{"jobId":"<unique_job_id>"}

Check job status
curl http://localhost:3000/status/<unique_job_id>


Example response:

{
  "status": "finished",
  "input": "storage/input/pic.jpeg",
  "output": "storage/output/pic_<jobId>.png"
}

File Structure
js_project/
├─ index.js           # Main server and processing logic
├─ storage/
│  ├─ input/          # Uploaded files
│  └─ output/         # Processed files
├─ package.json
├─ pic.jpeg           # Example image to use
└─ .gitignore
README.md
