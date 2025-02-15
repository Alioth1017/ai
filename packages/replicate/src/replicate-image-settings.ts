export type ReplicateImageModelId =
  | 'black-forest-labs/flux-1.1-pro'
  | 'black-forest-labs/flux-1.1-pro-ultra'
  | 'black-forest-labs/flux-dev'
  | 'black-forest-labs/flux-pro'
  | 'black-forest-labs/flux-schnell'
  | 'bytedance/sdxl-lightning-4step'
  | 'fofr/aura-flow'
  | 'fofr/latent-consistency-model'
  | 'fofr/realvisxl-v3-multi-controlnet-lora'
  | 'fofr/sdxl-emoji'
  | 'fofr/sdxl-multi-controlnet-lora'
  | 'ideogram-ai/ideogram-v2'
  | 'ideogram-ai/ideogram-v2-turbo'
  | 'lucataco/dreamshaper-xl-turbo'
  | 'lucataco/open-dalle-v1.1'
  | 'lucataco/realvisxl-v2.0'
  | 'lucataco/realvisxl2-lcm'
  | 'luma/photon'
  | 'luma/photon-flash'
  | 'nvidia/sana'
  | 'playgroundai/playground-v2.5-1024px-aesthetic'
  | 'recraft-ai/recraft-v3'
  | 'recraft-ai/recraft-v3-svg'
  | 'stability-ai/stable-diffusion-3.5-large'
  | 'stability-ai/stable-diffusion-3.5-large-turbo'
  | 'stability-ai/stable-diffusion-3.5-medium'
  | 'tstramer/material-diffusion'
  | (string & {});

export interface ReplicateImageSettings {
  /**
Override the maximum number of images per call (default 1)
   */
  maxImagesPerCall?: number;
}
