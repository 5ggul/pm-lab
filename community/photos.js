export async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WebP 사진만 첨부할 수 있습니다.');
 if(file.size>10*1024*1024)throw Error('사진은 장당 10MB까지 첨부할 수 있습니다.');
 let image;
 try{image=await createImageBitmap(file);}catch{throw Error('읽을 수 없는 사진입니다. 다른 파일을 선택해 주세요.');}
 try{
  const ratio=Math.min(1,2048/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  // Re-encode to remove EXIF location metadata and reduce upload size.
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
  if(!blob||blob.type!=='image/webp'||blob.size>5*1024*1024)throw Error('사진을 변환하지 못했습니다. 더 작은 사진을 선택해 주세요.');
  return {blob,url:URL.createObjectURL(blob)};
 }finally{image.close();}
}
