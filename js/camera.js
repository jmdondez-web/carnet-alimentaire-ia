let currentPhotoBase64 = null;

export function getCurrentPhoto() {
  return currentPhotoBase64;
}

export function setCurrentPhoto(base64) {
  currentPhotoBase64 = base64;
}

export function clearCurrentPhoto() {
  currentPhotoBase64 = null;
}

export function takePhoto() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handlePhotoFile(file).then(resolve);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export function uploadPhoto() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handlePhotoFile(file).then(resolve);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

// Redimensionne la photo en carré 300×300 (crop centré) avant stockage.
// Une photo de téléphone fait 3-8 Mo ; le localStorage plafonne à ~5 Mo.
// En 300×300 JPEG 75 %, on retombe à ~15-30 Ko : quotas préservés,
// et la taille suffit pour le suivi visuel du repas.
function resizeToSquare(dataUrl, size = 300, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // dégradation : photo originale si décodage impossible
    img.src = dataUrl;
  });
}

function handlePhotoFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      currentPhotoBase64 = await resizeToSquare(e.target.result);
      resolve(currentPhotoBase64);
    };
    reader.readAsDataURL(file);
  });
}

export function showPreview(containerId, imgId, base64) {
  const container = document.getElementById(containerId);
  const img = document.getElementById(imgId);
  if (container && img) {
    img.src = base64;
    container.style.display = "inline-block";
  }
}

export function hidePreview(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = "none";
  }
  clearCurrentPhoto();
}