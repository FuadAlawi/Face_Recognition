const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';

const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusTxt = document.getElementById('status');
const cameraBtn = document.createElement('button');
cameraBtn.textContent = 'Open Camera';
cameraBtn.style.margin = '10px';
dropZone.parentNode.insertBefore(cameraBtn, dropZone);

let video = null;
let isCameraOn = false;
let modelsLoaded = false;

async function loadModels() {
  try {
    showStatus('Loading face detection models...');
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    showStatus('Models loaded successfully');
  } catch (err) {
    showStatus('Error loading models: ' + err.message, true);
    console.error('Model loading error:', err);
  }
}

loadModels();

function clearZone() {
  dropZone.querySelectorAll('img,canvas').forEach(el => el.remove());
}
function showStatus(msg, isErr = false){
  statusTxt.textContent = msg;
  statusTxt.style.color = isErr ? '#c62828' : '#4158d0';
}
function handleFile(file){
  if(!file || !file.type.startsWith('image')){
    return showStatus('Selected file is not an image.', true);
  }

  clearZone();
  const img = new Image();
  img.onload = async () => {
    dropZone.append(img);
    await detectFaces(img);
  };
  img.src = URL.createObjectURL(file);
}

async function detectFaces(img){
  showStatus('Detecting faces…');
  const detections = await faceapi
    .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true);

  if(detections.length === 0){
    return showStatus('No faces found.');
  }


  const canvas = faceapi.createCanvasFromMedia(img);
  dropZone.append(canvas);
  faceapi.matchDimensions(canvas, { width: img.width, height: img.height });
  const resized = faceapi.resizeResults(detections, { width: img.width, height: img.height });
  faceapi.draw.drawDetections(canvas, resized);

  showStatus(`Faces detected: ${detections.length}`);
}

async function startCamera() {
  if (!modelsLoaded) {
    showStatus('Please wait, models are still loading...', true);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640,
        height: 480
      } 
    });
    video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.style.width = '100%';
    video.style.height = 'auto';
    clearZone();
    dropZone.appendChild(video);
    
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          setTimeout(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              resolve();
            }
          }, 100);
        } else {
          resolve();
        }
      };
    });
    
    isCameraOn = true;
    cameraBtn.textContent = 'Close Camera';
    showStatus('Camera started - detecting faces...');
    detectFacesFromVideo();
  } catch (err) {
    showStatus('Error accessing camera: ' + err.message, true);
    console.error('Camera error:', err);
  }
}

function stopCamera() {
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.remove();
    video = null;
    isCameraOn = false;
    cameraBtn.textContent = 'Open Camera';
    showStatus('Camera stopped');
  }
}

async function detectFacesFromVideo() {
  if (!isCameraOn || !video || !modelsLoaded) return;

  try {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Waiting for valid video dimensions...');
      requestAnimationFrame(detectFacesFromVideo);
      return;
    }

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks(true);

    const canvas = faceapi.createCanvasFromMedia(video);
    dropZone.appendChild(canvas);
    
    // Use video's actual dimensions
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
    const resized = faceapi.resizeResults(detections, displaySize);
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);
    
    resized.forEach((detection, i) => {
      const box = detection.detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, { 
        label: `Person ${i + 1}`,
        lineWidth: 2
      });
      drawBox.draw(canvas);
    });

    if (detections.length > 0) {
      showStatus(`${detections.length} person${detections.length > 1 ? 's' : ''} detected`);
    } else {
      showStatus('No faces detected');
    }

    requestAnimationFrame(detectFacesFromVideo);
  } catch (err) {
    console.error('Face detection error:', err);
    showStatus('Error detecting faces: ' + err.message, true);
  }
}

cameraBtn.addEventListener('click', () => {
  if (isCameraOn) {
    stopCamera();
  } else {
    startCamera();
  }
});

['dragenter','dragover'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  })
);
['dragleave','drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  })
);
dropZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  handleFile(file);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
