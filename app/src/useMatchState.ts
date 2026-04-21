import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { MatchState, OverlaySettings, VKChannel, DEFAULT_OVERLAY_SETTINGS } from './types';

// Generic RT subscription — fires onChange() on any change to the table
function useRealtimeTable(table: string, onChange: () => Promise<void>) {
  useEffect(() => {
    const channel = supabase
      .channel(`rt-${table}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => { void onChange(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [table, onChange]);
}

// ── Состояние матча (admin) ──────────────────────────────────────────────────
export function useMatchState() {
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('football_match_state')
      .select('state')
      .eq('id', 1)
      .single();
    if (data && !error) setState(data.state as MatchState);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useRealtimeTable('football_match_state', load);

  const updateState = async (newState: MatchState) => {
    setState(newState);
    await supabase.from('football_match_state').update({ state: newState }).eq('id', 1);
  };

  const resetMatch = async () => {
    if (!state) return;
    await updateState({
      ...state,
      score: { team1: 0, team2: 0 },
      timer: { ...state.timer, isRunning: false, startTimestamp: null, accumulatedTime: 0, half: 1 },
      goalAnimation: { ...state.goalAnimation, isActive: false },
      pauseScreen: { ...state.pauseScreen, isActive: false },
    });
  };

  const triggerGoalAnimation = async (
    teamSide: 'team1' | 'team2',
    teamName: string,
    newScore: { team1: number; team2: number }
  ) => {
    if (!state) return;
    const active: MatchState = {
      ...state,
      score: newScore,
      goalAnimation: { ...state.goalAnimation, isActive: true, goalId: Date.now(), teamSide, teamName, newScore },
    };
    await updateState(active);
    setTimeout(async () => {
      const next: MatchState = { ...active, goalAnimation: { ...active.goalAnimation, isActive: false } };
      await supabase.from('football_match_state').update({ state: next }).eq('id', 1);
      setState(next);
    }, 5000);
  };

  const triggerCardEvent = async (
    teamSide: 'team1' | 'team2',
    cardType: 'yellow' | 'red',
    playerName: string
  ) => {
    if (!state) return;
    const active: MatchState = {
      ...state,
      cardEvent: { isActive: true, cardId: Date.now(), teamSide, cardType, playerName },
    };
    await updateState(active);
    setTimeout(async () => {
      const next: MatchState = { ...active, cardEvent: { ...active.cardEvent, isActive: false } };
      await supabase.from('football_match_state').update({ state: next }).eq('id', 1);
      setState(next);
    }, 4000);
  };

  return { state, updateState, resetMatch, triggerGoalAnimation, triggerCardEvent, loading };
}

// ── Настройки оверлея (admin) ────────────────────────────────────────────────
export function useOverlaySettings() {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('overlay_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (data && !error) setSettings({ ...DEFAULT_OVERLAY_SETTINGS, ...(data as OverlaySettings) });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useRealtimeTable('overlay_settings', load);

  const updateSettings = async (patch: Partial<OverlaySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const { id, ...rest } = next;
    await supabase.from('overlay_settings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', 1);
  };

  const resetToDefaults = async () => {
    const defaults = { ...DEFAULT_OVERLAY_SETTINGS };
    setSettings(defaults);
    const { id, ...rest } = defaults;
    await supabase.from('overlay_settings').update(rest).eq('id', 1);
  };

  return { settings, updateSettings, resetToDefaults, loading };
}

// Alias: RT уже встроен в useOverlaySettings
export const useOverlaySettingsRT = useOverlaySettings;

// ── VK Каналы ────────────────────────────────────────────────────────────────
export function useVKChannels() {
  const [channels, setChannels] = useState<VKChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('vk_channels')
      .select('*')
      .order('created_at', { ascending: true });
    if (data && !error) setChannels(data as VKChannel[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useRealtimeTable('vk_channels', load);

  const addChannel = async (ch: Omit<VKChannel, 'id' | 'created_at'>) => {
    await supabase.from('vk_channels').insert(ch);
    await load();
  };

  const deleteChannel = async (id: number) => {
    await supabase.from('vk_channels').delete().eq('id', id);
    setChannels(prev => prev.filter(c => c.id !== id));
  };

  const setActiveChannel = async (id: number) => {
    await supabase.from('vk_channels').update({ is_active: false }).neq('id', -1);
    await supabase.from('vk_channels').update({ is_active: true }).eq('id', id);
    await load();
  };

  const updateChannel = async (id: number, patch: Partial<VKChannel>) => {
    await supabase.from('vk_channels').update(patch).eq('id', id);
    await load();
  };

  return { channels, addChannel, deleteChannel, setActiveChannel, updateChannel, loading, refresh: load };
}

// ── Управление сервером стрима ────────────────────────────────────────────────
export function useStreamControl() {
  const [controlApiUrl, setControlApiUrl] = useState('');
  const [controlSecret, setControlSecret] = useState('');

  useEffect(() => {
    supabase.from('app_config').select('control_api_url,control_secret').eq('id', 1).single()
      .then(({ data }) => {
        if (data?.control_api_url) setControlApiUrl(data.control_api_url);
        if (data?.control_secret) setControlSecret(data.control_secret);
      });
  }, []);

  const saveControlSettings = async (url: string, secret: string) => {
    setControlApiUrl(url);
    setControlSecret(secret);
    await supabase.from('app_config').update({ control_api_url: url, control_secret: secret }).eq('id', 1);
  };

  return { controlApiUrl, controlSecret, saveControlSettings };
}

// ── Overlay: RT-хук для Browser Source (payload.new напрямую — минимальная задержка) ──
export function useOverlayState() {
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('football_match_state').select('state').eq('id', 1).single()
      .then(({ data, error }) => {
        if (data && !error) setState(data.state as MatchState);
        setLoading(false);
      });

    const channel = supabase
      .channel('overlay-match-state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'football_match_state', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new?.state) setState(payload.new.state as MatchState);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  const updateState = async (newState: MatchState) => {
    setState(newState);
    await supabase.from('football_match_state').update({ state: newState }).eq('id', 1);
  };

  const resetMatch = async () => {
    if (!state) return;
    await updateState({
      ...state,
      score: { team1: 0, team2: 0 },
      timer: { ...state.timer, isRunning: false, startTimestamp: null, accumulatedTime: 0, half: 1 },
      goalAnimation: { ...state.goalAnimation, isActive: false },
      pauseScreen: { ...state.pauseScreen, isActive: false },
    });
  };

  const triggerGoalAnimation = async (
    teamSide: 'team1' | 'team2',
    teamName: string,
    newScore: { team1: number; team2: number }
  ) => {
    if (!state) return;
    const active: MatchState = {
      ...state,
      score: newScore,
      goalAnimation: { ...state.goalAnimation, isActive: true, goalId: Date.now(), teamSide, teamName, newScore },
    };
    await updateState(active);
    setTimeout(async () => {
      const next: MatchState = { ...active, goalAnimation: { ...active.goalAnimation, isActive: false } };
      await supabase.from('football_match_state').update({ state: next }).eq('id', 1);
      setState(next);
    }, 5000);
  };

  const triggerCardEvent = async (
    teamSide: 'team1' | 'team2',
    cardType: 'yellow' | 'red',
    playerName: string
  ) => {
    if (!state) return;
    const active: MatchState = {
      ...state,
      cardEvent: { isActive: true, cardId: Date.now(), teamSide, cardType, playerName },
    };
    await updateState(active);
    setTimeout(async () => {
      const next: MatchState = { ...active, cardEvent: { ...active.cardEvent, isActive: false } };
      await supabase.from('football_match_state').update({ state: next }).eq('id', 1);
      setState(next);
    }, 4000);
  };

  return { state, updateState, resetMatch, triggerGoalAnimation, triggerCardEvent, loading };
}

// ── Медиатека ─────────────────────────────────────────────────────────────────
export function useMediaLibrary() {
  const [items, setItems] = useState<import('./types').MediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('media_library')
      .select('id,name,created_at')
      .order('created_at', { ascending: true });
    if (data && !error) setItems(data as import('./types').MediaLibraryItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const addTrack = async (name: string, dataUrl: string) => {
    await supabase.from('media_library').insert({ name, data_url: dataUrl });
    await fetchItems();
  };

  const deleteTrack = async (id: number) => {
    await supabase.from('media_library').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const getTrackDataUrl = async (id: number): Promise<string> => {
    const { data } = await supabase.from('media_library').select('data_url').eq('id', id).single();
    return data?.data_url ?? '';
  };

  return { items, loading, addTrack, deleteTrack, getTrackDataUrl };
}
