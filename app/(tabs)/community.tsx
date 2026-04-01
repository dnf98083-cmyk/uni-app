import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';

const TABS = ['전체', '자유', '질문', '정보', '익명'];
const TAB_EMOJIS: Record<string, string> = { 자유: '😊', 질문: '❓', 정보: 'ℹ️', 익명: '🕵️' };

type Post = {
  id: string;
  tab: string;
  title: string;
  body: string;
  author_id: string;
  author_nickname: string;
  is_anonymous: boolean;
  likes: number;
  created_at: string;
  comment_count: number;
};

type Comment = {
  id: string;
  post_id: string;
  author_nickname: string;
  body: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function CommunityScreen() {
  const { colors } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedTab, setSelectedTab] = useState('전체');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [writeModal, setWriteModal] = useState(false);
  const [writeTab, setWriteTab] = useState('자유');
  const [writeTitle, setWriteTitle] = useState('');
  const [writeBody, setWriteBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState('');

  const [commentModal, setCommentModal] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const channelRef = useRef<any>(null);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, comments(count)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data.map((p: any) => ({
        ...p,
        comment_count: p.comments?.[0]?.count ?? 0,
      })));
    }
    setLoadingPosts(false);
  };

  useEffect(() => {
    fetchPosts();

    // 실시간 새 게시글 구독
    channelRef.current = supabase
      .channel('posts-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  };

  const submitPost = async () => {
    if (!writeTitle.trim() || !writeBody.trim()) return;
    setPostError('');
    setSubmitting(true);
    try {
      const user = await getCurrentUser();
      const isAnon = writeTab === '익명';
      const { error } = await supabase.from('posts').insert({
        tab: writeTab,
        title: writeTitle.trim(),
        body: writeBody.trim(),
        author_id: user?.id ?? null,
        author_nickname: isAnon ? '익명' : (user?.user_metadata?.nickname ?? '학생'),
        is_anonymous: isAnon,
      });
      if (error) {
        setPostError('저장 실패: ' + error.message);
      } else {
        setWriteTitle('');
        setWriteBody('');
        setWriteTab('자유');
        setWriteModal(false);
        fetchPosts();
      }
    } catch (e: any) {
      setPostError(e?.message ?? '알 수 없는 오류가 발생했어요');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    const isLiked = likedIds.has(post.id);
    const newLikes = isLiked ? post.likes - 1 : post.likes + 1;
    setLikedIds(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
  };

  const openComments = async (post: Post) => {
    setCommentPost(post);
    setCommentModal(true);
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !commentPost) return;
    setSendingComment(true);
    const user = await getCurrentUser();
    const { data, error } = await supabase.from('comments').insert({
      post_id: commentPost.id,
      author_id: user?.id ?? null,
      author_nickname: user?.user_metadata?.nickname ?? '학생',
      body: commentText.trim(),
    }).select().single();
    setSendingComment(false);
    if (!error && data) {
      setComments(prev => [...prev, data]);
      setPosts(prev => prev.map(p =>
        p.id === commentPost.id ? { ...p, comment_count: p.comment_count + 1 } : p
      ));
      setCommentText('');
    }
  };

  const sharePost = async (post: Post) => {
    try {
      await Share.share({ message: `[${post.tab}] ${post.title}\n\n${post.body}` });
    } catch {}
  };

  const filtered = selectedTab === '전체' ? posts : posts.filter(p => p.tab === selectedTab);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.accent }]}>커뮤니티 💬</Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>지금 학교에서 뜨고 있는 이야기</Text>
        </View>
        <TouchableOpacity style={styles.writeBtn} onPress={() => setWriteModal(true)}>
          <Text style={styles.writeBtnText}>✏️ 글쓰기</Text>
        </TouchableOpacity>
      </View>

      {/* 탭 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab}
            style={[styles.tabChip, { backgroundColor: colors.card, borderColor: colors.border }, selectedTab === tab && styles.tabChipActive]}
            onPress={() => setSelectedTab(tab)}>
            <Text style={[styles.tabText, { color: colors.subText }, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 게시글 목록 */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loadingPosts ? (
          <View style={styles.empty}>
            <ActivityIndicator color="#7c6fff" size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>아직 게시글이 없어요</Text>
            <Text style={[styles.emptySub, { color: colors.subText }]}>첫 번째 글을 작성해보세요!</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setWriteModal(true)}>
              <Text style={styles.emptyBtnText}>✏️ 글쓰기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(post => (
            <View key={post.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.postHeader}>
                <View style={[styles.postEmojiBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Text style={styles.postEmoji}>{TAB_EMOJIS[post.tab] ?? '📝'}</Text>
                </View>
                <View style={styles.postMeta}>
                  <Text style={[styles.postAuthor, { color: colors.text }]}>{post.author_nickname}</Text>
                  <Text style={[styles.postTime, { color: colors.subText }]}>{timeAgo(post.created_at)}</Text>
                </View>
                <View style={[styles.postTabBadge, { backgroundColor: colors.accent + '18' }]}>
                  <Text style={[styles.postTabText, { color: colors.accent }]}>{post.tab}</Text>
                </View>
              </View>
              <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>
              <Text style={[styles.postBody, { color: colors.subText }]} numberOfLines={3}>{post.body}</Text>
              <View style={[styles.postFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.postAction} onPress={() => toggleLike(post)}>
                  <Text style={styles.postActionIcon}>{likedIds.has(post.id) ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.postActionText, { color: colors.subText }, likedIds.has(post.id) && styles.likedText]}>
                    {post.likes}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={() => openComments(post)}>
                  <Text style={styles.postActionIcon}>💬</Text>
                  <Text style={[styles.postActionText, { color: colors.subText }]}>{post.comment_count}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={() => sharePost(post)}>
                  <Text style={styles.postActionIcon}>↗️</Text>
                  <Text style={[styles.postActionText, { color: colors.subText }]}>공유</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 글쓰기 모달 */}
      <Modal visible={writeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>글쓰기</Text>
              <TouchableOpacity onPress={() => setWriteModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TABS.filter(t => t !== '전체').map(tab => (
                  <TouchableOpacity key={tab}
                    style={[styles.tabChip, writeTab === tab && styles.tabChipActive]}
                    onPress={() => setWriteTab(tab)}>
                    <Text style={[styles.tabText, writeTab === tab && styles.tabTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={styles.titleInput}
              placeholder="제목을 입력하세요"
              placeholderTextColor="#44445a"
              value={writeTitle}
              onChangeText={setWriteTitle}
              maxLength={50}
            />
            <TextInput
              style={styles.bodyInput}
              placeholder="내용을 입력하세요"
              placeholderTextColor="#44445a"
              value={writeBody}
              onChangeText={setWriteBody}
              multiline
              textAlignVertical="top"
            />
            {postError ? <Text style={styles.postErrorText}>{postError}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, (!writeTitle.trim() || !writeBody.trim() || submitting) && styles.submitBtnDisabled]}
              onPress={submitPost}
              disabled={!writeTitle.trim() || !writeBody.trim() || submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>등록하기</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 댓글 모달 */}
      <Modal visible={commentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.commentModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>댓글 {comments.length}개</Text>
              <TouchableOpacity onPress={() => { setCommentModal(false); setComments([]); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {commentPost && (
              <View style={styles.commentPostPreview}>
                <Text style={styles.commentPostTitle} numberOfLines={1}>{commentPost.title}</Text>
              </View>
            )}
            <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
              {loadingComments ? (
                <ActivityIndicator color="#7c6fff" style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.noComment}>첫 댓글을 남겨보세요!</Text>
              ) : (
                comments.map(c => (
                  <View key={c.id} style={styles.commentItem}>
                    <View style={styles.commentLeft}>
                      <Text style={styles.commentAuthor}>{c.author_nickname}</Text>
                      <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="댓글을 입력하세요"
                placeholderTextColor="#44445a"
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, (!commentText.trim() || sendingComment) && styles.commentSendBtnDisabled]}
                onPress={submitComment}
                disabled={!commentText.trim() || sendingComment}>
                {sendingComment
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.commentSendBtnText}>↑</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 3 },
  writeBtn: { backgroundColor: '#7c6fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  writeBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  tabScroll: { flexGrow: 0, marginBottom: 12 },
  tabChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1,
  },
  tabChipActive: { backgroundColor: '#7c6fff', borderColor: '#7c6fff' },
  tabText: { fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  list: { flex: 1, paddingHorizontal: 16 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 13, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#7c6fff', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  postCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 14, marginBottom: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postEmojiBox: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  postEmoji: { fontSize: 18 },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: 13, fontWeight: '700' },
  postTime: { fontSize: 11, marginTop: 1 },
  postTabBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  postTabText: { fontSize: 10, fontWeight: '700' },
  postTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  postBody: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  postFooter: { flexDirection: 'row', gap: 16, borderTopWidth: 1, paddingTop: 10 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionIcon: { fontSize: 14 },
  postActionText: { fontSize: 12 },
  likedText: { color: '#ff6b6b' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  modalClose: { fontSize: 18, color: '#555' },

  titleInput: {
    backgroundColor: '#0d0d16', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#eee', fontSize: 15, fontWeight: '600', marginBottom: 12,
  },
  bodyInput: {
    backgroundColor: '#0d0d16', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#eee', fontSize: 14, height: 140, marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#7c6fff', borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c6fff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { backgroundColor: '#2a2a40', shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  postErrorText: { fontSize: 12, color: '#ff6b6b', marginBottom: 8, textAlign: 'center' },

  commentModalCard: {
    backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 12, maxHeight: '70%',
  },
  commentPostPreview: {
    backgroundColor: '#0d0d16', borderRadius: 10, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a40',
  },
  commentPostTitle: { fontSize: 13, color: '#888' },
  commentList: { flex: 1, marginBottom: 12 },
  noComment: { fontSize: 13, color: '#555', textAlign: 'center', paddingVertical: 24 },
  commentItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  commentLeft: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#a78bfa' },
  commentTime: { fontSize: 11, color: '#444' },
  commentText: { fontSize: 13, color: '#ddd', lineHeight: 18 },
  commentInputRow: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2a2a40',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  commentInput: {
    flex: 1, backgroundColor: '#0d0d16', borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a40',
    paddingHorizontal: 14, paddingVertical: 10,
    color: '#eee', fontSize: 13,
  },
  commentSendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#7c6fff', alignItems: 'center', justifyContent: 'center',
  },
  commentSendBtnDisabled: { backgroundColor: '#2a2a40' },
  commentSendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
