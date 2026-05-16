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

function handlePhotoFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentPhotoBase64 = e.target.result;
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