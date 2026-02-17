export const getDims = async (file: File): Promise<number[]> => {
  const img = new Image()
  img.src = URL.createObjectURL(file)
  return new Promise(resolve => (img.onload = () => resolve([img.width, img.height])))
}
