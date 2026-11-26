import { Linking } from 'react-native';
import { sanitizeExternalHttpUrl } from './urlSafety';

export { sanitizeExternalHttpUrl };

export async function openSafeExternalUrl(rawUrl?: string | null): Promise<boolean> {
  const safeUrl = sanitizeExternalHttpUrl(rawUrl);
  if (!safeUrl) return false;
  try {
    await Linking.openURL(safeUrl);
    return true;
  } catch {
    return false;
  }
}
