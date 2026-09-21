import { AudioPlayer, createAudioPlayer } from 'expo-audio';

const SOURCES = {
  combat: require('../../assets/music/combat.wav'),
} as const;

export type Track = keyof typeof SOURCES;

let player: AudioPlayer | null = null;
let enabled = true;
let ready = false;

/** Démarre la musique de fond en boucle (une seule piste pour l'instant). */
export async function initMusic() {
  if (ready) return;
  ready = true;
  try {
    player = createAudioPlayer(SOURCES.combat);
    player.loop = true;
    player.volume = 0.35;
    // le chargement du fichier est asynchrone : jouer tout de suite après createAudioPlayer() peut
    // ne rien faire si l'audio n'est pas encore prêt (contrairement aux bruitages, joués bien plus
    // tard, au premier tap, qui ont largement le temps de charger).
    if (player.isLoaded) {
      if (enabled) player.play();
    } else {
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded) {
          sub.remove();
          if (enabled) player?.play();
        }
      });
    }
  } catch (e) { console.warn('Musique : lecture impossible', e); }
}

export function setMusicEnabled(on: boolean) {
  enabled = on;
  if (!player) return;
  try { on ? player.play() : player.pause(); } catch (e) { console.warn('Musique : bascule impossible', e); }
}
