import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Text } from './Text';
import { Icon } from './ui';
import { colors, radius } from './theme';
import { label, relative } from '@/lib/format';
import type { JobImage, VoiceNote } from '@/lib/types';

/** Thumbnails of the visit photos; tap to see one full screen, swipe through the rest. */
export function PhotoGrid({ images }: { images: JobImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {images.map((img, i) => (
          <Pressable key={img.id} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={`${label(img.type)} photo`} style={{ width: '31.5%' }}>
            <Image source={{ uri: img.url }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
              {label(img.type)}
            </Text>
          </Pressable>
        ))}
      </View>
      {open !== null && <Viewer images={images} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Viewer({ images, start, onClose }: { images: JobImage[]; start: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(start);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            contentOffset={{ x: start * width, y: 0 }}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            showsHorizontalScrollIndicator={false}
          >
            {images.map((img) => (
              <Image key={img.id} source={{ uri: img.url }} resizeMode="contain" style={{ width, height: '100%' }} />
            ))}
          </ScrollView>
        )}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            {label(images[index]?.type)} · {index + 1}/{images.length}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Icon name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Plays the technician's voice notes one at a time. */
export function VoiceNoteList({ notes }: { notes: VoiceNote[] }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<number | null>(null);

  useEffect(() => {
    if (status.didJustFinish) setPlayingId(null);
  }, [status.didJustFinish]);

  const toggle = async (n: VoiceNote) => {
    if (playingId === n.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    player.replace({ uri: n.url });
    player.play();
    setPlayingId(n.id);
  };

  return (
    <View style={{ gap: 8 }}>
      {notes.map((n) => {
        const active = playingId === n.id;
        const playing = active && status.playing;
        const progress = active && status.duration ? Math.min(1, status.currentTime / status.duration) : 0;
        return (
          <Pressable
            key={n.id}
            onPress={() => toggle(n)}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.sm, backgroundColor: active ? colors.brandSoft : colors.bg, borderWidth: 1, borderColor: active ? colors.brand + '40' : colors.border }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={playing ? 'pause' : 'play'} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: colors.brand }} />
              </View>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {Math.floor(n.duration_seconds / 60)}:{String(n.duration_seconds % 60).padStart(2, '0')} · {n.uploader?.name ?? 'Technician'} · {relative(n.created_at)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
