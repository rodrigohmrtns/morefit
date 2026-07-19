import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { radius, shadow, spacing, ThemeColors, typography, useTheme } from '@/src/theme';

type Post = {
  id: string; user_id: string; author_name: string; author_avatar?: string | null;
  text: string; kind: 'update' | 'recipe' | 'workout' | 'photo'; image_base64?: string | null;
  likes: string[]; comments_count: number; created_at: string;
};
type Comment = {
  id: string; post_id: string; user_id: string; author_name: string; text: string; created_at: string;
};

const KINDS: { key: Post['kind']; label: string; icon: any; tint?: string }[] = [
  { key: 'update', label: 'Atualização', icon: 'chatbubble-ellipses' },
  { key: 'recipe', label: 'Receita', icon: 'restaurant' },
  { key: 'workout', label: 'Treino', icon: 'barbell' },
  { key: 'photo', label: 'Foto', icon: 'camera' },
];

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'update', label: 'Atualizações' },
  { key: 'recipe', label: 'Receitas' },
  { key: 'workout', label: 'Treinos' },
  { key: 'photo', label: 'Fotos' },
];

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newKind, setNewKind] = useState<Post['kind']>('update');
  const [posting, setPosting] = useState(false);

  const [selected, setSelected] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Post[] }>(`/community/posts?kind=${filter}&limit=50`);
      setPosts(res.items);
    } catch (e) { console.log(e); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submitPost = async () => {
    const txt = newText.trim();
    if (!txt) return;
    setPosting(true);
    try {
      await api('/community/posts', { method: 'POST', body: { text: txt, kind: newKind } });
      setNewText(''); setNewKind('update'); setComposerOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao publicar');
    } finally { setPosting(false); }
  };

  const toggleLike = async (p: Post) => {
    // optimistic update
    const uid = user?.user_id ?? '';
    const liked = p.likes.includes(uid);
    setPosts(prev => prev.map(x => x.id === p.id ? {
      ...x, likes: liked ? x.likes.filter(l => l !== uid) : [...x.likes, uid],
    } : x));
    try { await api(`/community/posts/${p.id}/like`, { method: 'POST' }); }
    catch { load(); }
  };

  const openComments = async (p: Post) => {
    setSelected(p); setComments([]); setLoadingComments(true);
    try {
      const res = await api<{ items: Comment[] }>(`/community/posts/${p.id}/comments`);
      setComments(res.items);
    } catch (e) { console.log(e); }
    finally { setLoadingComments(false); }
  };

  const addComment = async () => {
    if (!selected) return;
    const t = commentText.trim();
    if (!t) return;
    try {
      const c = await api<Comment>(`/community/posts/${selected.id}/comments`, { method: 'POST', body: { text: t } });
      setComments(prev => [...prev, c]);
      setCommentText('');
      setPosts(prev => prev.map(x => x.id === selected.id ? { ...x, comments_count: x.comments_count + 1 } : x));
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Falha ao comentar'); }
  };

  const deletePost = async (p: Post) => {
    Alert.alert('Excluir post?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try { await api(`/community/posts/${p.id}`, { method: 'DELETE' }); await load(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha'); }
      } },
    ]);
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="community-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title}>Comunidade</Text>
          <Pressable onPress={() => setComposerOpen(true)} style={s.newBtn} testID="community-new-post">
            <Ionicons name="add" size={20} color={colors.brandDark} />
          </Pressable>
        </View>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={[s.chip, filter === f.key && s.chipActive]}
              onPress={() => setFilter(f.key)}
              testID={`community-filter-${f.key}`}
            >
              <Text style={[s.chipTxt, filter === f.key && s.chipTxtActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.feed}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {posts.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.muted} />
            <Text style={s.emptyTitle}>Ninguém publicou ainda</Text>
            <Text style={s.emptySub}>Seja o primeiro a compartilhar sua jornada!</Text>
            <Pressable style={s.emptyBtn} onPress={() => setComposerOpen(true)}>
              <Ionicons name="add" size={18} color={colors.brandDark} />
              <Text style={s.emptyBtnTxt}>Criar post</Text>
            </Pressable>
          </View>
        )}

        {posts.map(p => (
          <PostCard
            key={p.id}
            p={p}
            colors={colors}
            meId={user?.user_id ?? ''}
            onLike={() => toggleLike(p)}
            onComment={() => openComments(p)}
            onDelete={() => deletePost(p)}
          />
        ))}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Composer Modal */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Novo post</Text>
              <Pressable onPress={() => setComposerOpen(false)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
              {KINDS.map(k => (
                <Pressable key={k.key} onPress={() => setNewKind(k.key)} style={[s.kindChip, newKind === k.key && s.kindChipActive]}>
                  <Ionicons name={k.icon} size={14} color={newKind === k.key ? colors.brandDark : colors.onSurface} />
                  <Text style={[s.kindChipTxt, newKind === k.key && { color: colors.brandDark, fontWeight: '800' }]}>{k.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              value={newText}
              onChangeText={setNewText}
              placeholder="O que você quer compartilhar?"
              placeholderTextColor={colors.muted}
              multiline
              style={s.composer}
              testID="community-composer-input"
            />
            <Pressable
              style={[s.submitBtn, (!newText.trim() || posting) && { opacity: 0.5 }]}
              disabled={!newText.trim() || posting}
              onPress={submitPost}
              testID="community-composer-submit"
            >
              {posting ? <ActivityIndicator color={colors.brandDark} /> :
                <><Ionicons name="paper-plane" size={16} color={colors.brandDark} /><Text style={s.submitTxt}>Publicar</Text></>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Comments modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
          <View style={s.header}>
            <Pressable onPress={() => setSelected(null)} style={s.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={s.title}>Comentários</Text>
            <View style={{ width: 40 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              {selected && (
                <PostCard p={selected} colors={colors} meId={user?.user_id ?? ''} readOnly />
              )}
              {loadingComments && <ActivityIndicator color={colors.brandPrimary} />}
              {comments.map(c => (
                <View key={c.id} style={s.commentRow}>
                  <View style={s.commentAvatar}><Text style={s.commentAvatarTxt}>{c.author_name[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={s.commentBubble}>
                      <Text style={s.commentAuthor}>{c.author_name}</Text>
                      <Text style={s.commentText}>{c.text}</Text>
                    </View>
                    <Text style={s.commentTime}>{formatWhen(c.created_at)}</Text>
                  </View>
                </View>
              ))}
              {!loadingComments && comments.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.muted, marginTop: spacing.xl }}>Seja o primeiro a comentar</Text>
              )}
            </ScrollView>
            <View style={s.commentBar}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Escreva um comentário…"
                placeholderTextColor={colors.muted}
                style={s.commentInput}
                testID="community-comment-input"
              />
              <Pressable style={[s.sendBtn, !commentText.trim() && { opacity: 0.5 }]} disabled={!commentText.trim()} onPress={addComment} testID="community-comment-send">
                <Ionicons name="send" size={18} color={colors.brandDark} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function PostCard({ p, colors, meId, onLike, onComment, onDelete, readOnly }: {
  p: Post; colors: ThemeColors; meId: string;
  onLike?: () => void; onComment?: () => void; onDelete?: () => void; readOnly?: boolean;
}) {
  const s = makeStyles(colors);
  const liked = p.likes.includes(meId);
  const isMine = p.user_id === meId;
  const kindMeta = KINDS.find(k => k.key === p.kind);
  return (
    <View style={s.postCard}>
      <View style={s.postHead}>
        <View style={s.postAvatar}>
          {p.author_avatar ? (
            <Image source={{ uri: `data:image/jpeg;base64,${p.author_avatar}` }} style={{ width: 40, height: 40 }} contentFit="cover" />
          ) : (
            <Text style={s.postAvatarTxt}>{(p.author_name[0] ?? '?').toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.postAuthor}>{p.author_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={s.kindBadge}>
              <Ionicons name={kindMeta?.icon ?? 'chatbubble'} size={10} color={colors.onBrandTertiary} />
              <Text style={s.kindBadgeTxt}>{kindMeta?.label ?? 'Post'}</Text>
            </View>
            <Text style={s.postTime}>{formatWhen(p.created_at)}</Text>
          </View>
        </View>
        {isMine && !readOnly && (
          <Pressable onPress={onDelete} style={s.moreBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
      <Text style={s.postText}>{p.text}</Text>
      {!readOnly && (
        <View style={s.postActions}>
          <Pressable onPress={onLike} style={s.actionBtn} testID={`community-like-${p.id}`}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.error : colors.muted} />
            <Text style={[s.actionTxt, liked && { color: colors.error, fontWeight: '700' }]}>{p.likes.length}</Text>
          </Pressable>
          <Pressable onPress={onComment} style={s.actionBtn} testID={`community-comment-${p.id}`}>
            <Ionicons name="chatbubble-outline" size={19} color={colors.muted} />
            <Text style={s.actionTxt}>{p.comments_count}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR');
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: colors.onSurface },
  newBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },

  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTxt: { ...typography.small, color: colors.onSurface, fontWeight: '600' },
  chipTxtActive: { color: colors.brandDark, fontWeight: '800' },

  feed: { padding: spacing.lg, gap: spacing.md },
  postCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  postAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postAvatarTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  postAuthor: { ...typography.bodyStrong, color: colors.onSurface },
  postTime: { ...typography.small, color: colors.muted },
  kindBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brandTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  kindBadgeTxt: { ...typography.small, color: colors.onBrandTertiary, fontWeight: '700', fontSize: 10 },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  postText: { ...typography.body, color: colors.onSurface, lineHeight: 22 },
  postActions: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTxt: { ...typography.caption, color: colors.muted, fontWeight: '600' },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.headline, color: colors.onSurface, marginTop: spacing.sm },
  emptySub: { ...typography.caption, color: colors.muted },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.md },
  emptyBtnTxt: { ...typography.body, color: colors.brandDark, fontWeight: '800' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { ...typography.title, color: colors.onSurface },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  kindChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  kindChipTxt: { ...typography.small, color: colors.onSurface, fontWeight: '600' },
  composer: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, minHeight: 120, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top', ...typography.body },
  submitBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md },
  submitTxt: { ...typography.bodyStrong, color: colors.brandDark },

  commentRow: { flexDirection: 'row', gap: spacing.sm },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarTxt: { color: colors.onBrandPrimary, fontWeight: '700', fontSize: 13 },
  commentBubble: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  commentAuthor: { ...typography.small, color: colors.onSurface, fontWeight: '700' },
  commentText: { ...typography.body, color: colors.onSurface, marginTop: 2 },
  commentTime: { ...typography.small, color: colors.muted, marginTop: 2, marginLeft: spacing.sm },
  commentBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSecondary, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, ...typography.body },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
});
