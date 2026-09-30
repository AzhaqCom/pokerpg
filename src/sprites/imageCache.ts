import { SkImage, Skia, loadData } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

/**
 * Cache des planches de sprites décodées (Skia). `useImage` de Skia n'en a aucun : chaque combattant qui apparaît relisait
 * et redécodait sa planche (jusqu'à ~300 Ko de PNG, ~1,2 Mo décodée), à chaque vague, même pour une espèce déjà vue — et
 * dans Expo Go la planche arrive par le réseau depuis Metro, d'où des ennemis invisibles et des animations saccadées.
 * Les `MAX_IMAGES` dernières planches utilisées restent en mémoire (≈ 30 Mo au plus).
 */
const MAX_IMAGES = 24;
const cache = new Map<number, SkImage>(); // ordre d'insertion = ordre d'utilisation (la plus ancienne en tête)
const pending = new Map<number, Promise<SkImage | null>>();

function remember(asset: number, img: SkImage) {
  cache.delete(asset);
  cache.set(asset, img);
  while (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value as number);
}

/** Planche déjà décodée (et marquée comme récemment utilisée), sinon `null`. */
export function cachedImage(asset: number): SkImage | null {
  const img = cache.get(asset);
  if (img) remember(asset, img);
  return img ?? null;
}

/** Décode une planche en arrière-plan (une seule fois, même si plusieurs combattants la demandent en même temps). */
export function preloadImage(asset: number): Promise<SkImage | null> {
  const hit = cache.get(asset);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(asset);
  if (!p) {
    p = loadData(asset, (data) => Skia.Image.MakeImageFromEncoded(data))
      .then((img) => { if (img) remember(asset, img); return img; })
      .catch(() => null)
      .finally(() => pending.delete(asset));
    pending.set(asset, p);
  }
  return p;
}

/** Remplace `useImage` de Skia pour les sprites : immédiat si la planche est en cache, sinon chargée une seule fois. */
export function useSpriteImage(asset: number | null | undefined): SkImage | null {
  const [, setLoaded] = useState(0);
  const img = asset == null ? null : cachedImage(asset);
  useEffect(() => {
    if (asset == null || img) return;
    let alive = true;
    preloadImage(asset).then(() => { if (alive) setLoaded((n) => n + 1); });
    return () => { alive = false; };
  }, [asset, img]);
  return img;
}
