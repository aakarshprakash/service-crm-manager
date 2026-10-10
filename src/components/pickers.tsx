import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, View } from 'react-native';
import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Text } from './Text';
import { Button, Field, Icon, Input, Sheet, styles as ui, type IconName } from './ui';
import { colors, radius } from './theme';
import { dateTime } from '@/lib/format';

/** Looks like an input; opens a picker instead of the keyboard. */
export function PickerField({ label, value, placeholder = 'Select…', onPress, error, hint, icon = 'chevron-down', required, disabled }: {
  label?: string; value?: string | null; placeholder?: string; onPress: () => void; error?: string; hint?: string; icon?: IconName; required?: boolean; disabled?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value || placeholder}` : value || placeholder}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [ui.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, opacity: disabled ? 0.5 : 1 }, pressed && { backgroundColor: colors.bg }, error ? { borderColor: colors.red } : null]}
      >
        <Text style={{ flex: 1, fontSize: 16, color: value ? colors.text : colors.faint }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Icon name={icon} size={18} color={colors.muted} />
      </Pressable>
    </Field>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
  detail?: string;
  tone?: string;
}

/** Bottom sheet list to choose one option, with search for long lists. */
export function SelectSheet<T extends string | number>({ open, title, options, value, onSelect, onClose, emptyText = 'Nothing to choose from.' }: {
  open: boolean; title: string; options: Option<T>[]; value?: T | null; onSelect: (v: T) => void; onClose: () => void; emptyText?: string;
}) {
  const [search, setSearch] = useState('');
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? options.filter((o) => `${o.label} ${o.detail ?? ''}`.toLowerCase().includes(s)) : options;
  }, [options, search]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {options.length > 8 && <Input value={search} onChangeText={setSearch} placeholder="Search…" autoCorrect={false} />}
      <FlatList
        scrollEnabled={false}
        data={shown}
        keyExtractor={(o) => String(o.value)}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>{emptyText}</Text>}
        renderItem={({ item: o }) => {
          const on = o.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                onSelect(o.value);
                setSearch('');
                onClose();
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: pressed ? colors.bg : 'transparent' })}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? colors.brand : colors.text }}>{o.label}</Text>
                {o.detail ? <Text style={{ fontSize: 12, color: o.tone ?? colors.muted }}>{o.detail}</Text> : null}
              </View>
              {on && <Icon name="checkmark" size={20} color={colors.brand} />}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const at = (base: Date, days: number, h: number, m = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Date + time for a visit: quick chips (today / tomorrow) or the system pickers. */
export function DateTimeField({ label, value, onChange, error, required, allowClear }: { label: string; value: Date | null; onChange: (d: Date | null) => void; error?: string; required?: boolean; allowClear?: boolean }) {
  const [iosOpen, setIosOpen] = useState(false);
  const now = new Date();
  const pick = () => {
    const start = value ?? at(now, now.getHours() >= 17 ? 1 : 0, Math.max(10, Math.min(now.getHours() + 1, 18)));
    if (Platform.OS !== 'android') {
      if (!value) onChange(start);
      setIosOpen(true);
      return;
    }
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      minimumDate: at(now, -1, 0),
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        DateTimePickerAndroid.open({
          value: start,
          mode: 'time',
          is24Hour: false,
          onChange: (e2, t) => {
            if (e2.type !== 'set' || !t) return;
            const out = new Date(d);
            out.setHours(t.getHours(), t.getMinutes(), 0, 0);
            onChange(out);
          },
        });
      },
    });
  };
  const chips: [string, Date][] = [
    ['Today 2 pm', at(now, 0, 14)],
    ['Tomorrow 10 am', at(now, 1, 10)],
    ['Tomorrow 3 pm', at(now, 1, 15)],
  ].filter(([, d]) => (d as Date).getTime() > now.getTime()) as [string, Date][];
  return (
    <View style={{ gap: 8 }}>
      <PickerField label={label} required={required} error={error} value={value ? dateTime(value.toISOString()) : null} placeholder="Pick date & time" icon="calendar-outline" onPress={pick} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {chips.map(([l, d]) => (
          <Chip key={l} label={l} on={!!value && value.getTime() === d.getTime()} onPress={() => onChange(d)} />
        ))}
        {allowClear && value && <Chip label="Clear" onPress={() => onChange(null)} />}
      </View>
      {iosOpen && Platform.OS !== 'android' && (
        <Sheet open onClose={() => setIosOpen(false)} title={label} footer={<Button title="Done" style={{ flex: 1 }} onPress={() => setIosOpen(false)} />}>
          <RNDateTimePicker value={value ?? now} mode="datetime" display="inline" minimumDate={at(now, -1, 0)} onValueChange={(_e, d) => onChange(d)} />
        </Sheet>
      )}
    </View>
  );
}

export function Chip({ label, on, onPress, count, tone = colors.brand }: { label: string; on?: boolean; onPress: () => void; count?: number; tone?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.lg, borderWidth: 1,
        borderColor: on ? tone : colors.border, backgroundColor: on ? tone + '14' : pressed ? colors.bg : '#fff',
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? tone : colors.muted }}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={{ minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, backgroundColor: on ? tone : colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : colors.text }}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}
