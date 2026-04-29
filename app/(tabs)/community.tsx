import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
  parent_id: string | null;
  author_id: string | null;
  author_nickname: string;
  body: string;
  likes: number;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [writeModal, setWriteModal] = useState(false);
  const [writeTab, setWriteTab] = useState('자유');
  const [writeTitle, setWriteTitle] = useState('');
  const [writeBody, setWriteBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState('');

  const [detailModal, setDetailModal] = useState(false);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentLikedIds, setCommentLikedIds] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const channelRef = useRef<any>(null);

  const isAnonPost = (post: Post) => post.is_anonymous || post.tab === '익명';

  const anonNameMap = useMemo(() => {
    console.log('[익명체크] tab:', detailPost?.tab, '| is_anonymous:', detailPost?.is_anonymous, '| author_id:', detailPost?.author_id);
    console.log('[익명체크] 댓글 수:', comments.length, comments.map(c => ({ id: c.author_id, nick: c.author_nickname })));
    const map = new Map<string, string>();
    if (!detailPost || !isAnonPost(detailPost)) return map;
    const postKey = detailPost.author_id ?? `name:${detailPost.author_nickname}`;
    map.set(postKey, '익명1');
    let n = 2;
    for (const c of comments) {
      const key = c.author_id ?? `name:${c.author_nickname}`;
      if (!map.has(key)) map.set(key, `익명${n++}`);
    }
    console.log('[익명체크] 완성된 맵:', [...map.entries()]);
    return map;
  }, [detailPost, comments]);

  const getAnonName = (authorId: string | null, nickname: string) => {
    if (!detailPost || !isAnonPost(detailPost)) return nickname;
    const key = authorId ?? `name:${nickname}`;
    return anonNameMap.get(key) ?? '익명';
  };

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

  const fetchLikedIds = async (uid: string) => {
    const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', uid);
    if (data) setLikedIds(new Set(data.map((r: any) => r.post_id)));
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) fetchLikedIds(uid);
    };
    init();
    fetchPosts();
    channelRef.current = supabase
      .channel('posts-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  };

  const getNickname = async (uid: string, fallback: string) => {
    const { data } = await supabase.from('profiles').select('nickname').eq('id', uid).single();
    return data?.nickname ?? fallback;
  };

  const submitPost = async () => {
    if (!writeTitle.trim() || !writeBody.trim()) return;
    setPostError(''); setSubmitting(true);
    try {
      const user = await getCurrentUser();
      const isAnon = writeTab === '익명';
      const nickname = isAnon ? '익명' : (user ? await getNickname(user.id, user.user_metadata?.nickname ?? '학생') : '학생');
      const { error } = await supabase.from('posts').insert({
        tab: writeTab, title: writeTitle.trim(), body: writeBody.trim(),
        author_id: user?.id ?? null, author_nickname: nickname, is_anonymous: isAnon,
      });
      if (error) { setPostError('저장 실패: ' + error.message); }
      else { setWriteTitle(''); setWriteBody(''); setWriteTab('자유'); setWriteModal(false); fetchPosts(); }
    } catch (e: any) { setPostError(e?.message ?? '오류가 발생했어요'); }
    finally { setSubmitting(false); }
  };

  const toggleLike = async (post: Post) => {
    if (!currentUserId) return;
    const isLiked = likedIds.has(post.id);
    const newLikes = isLiked ? post.likes - 1 : post.likes + 1;
    setLikedIds(prev => { const n = new Set(prev); isLiked ? n.delete(post.id) : n.add(post.id); return n; });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    if (detailPost?.id === post.id) setDetailPost(p => p ? { ...p, likes: newLikes } : p);
    if (isLiked) await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
    else await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });
    await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
  };

  const toggleCommentLike = async (comment: Comment) => {
    if (!currentUserId) return;
    const isLiked = commentLikedIds.has(comment.id);
    const newLikes = isLiked ? comment.likes - 1 : comment.likes + 1;
    setCommentLikedIds(prev => { const n = new Set(prev); isLiked ? n.delete(comment.id) : n.add(comment.id); return n; });
    setComments(prev => prev.map(c => c.id === comment.id ? { ...c, likes: newLikes } : c));
    if (isLiked) await supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_id', currentUserId);
    else await supabase.from('comment_likes').insert({ comment_id: comment.id, user_id: currentUserId });
    await supabase.from('comments').update({ likes: newLikes }).eq('id', comment.id);
  };

  const openDetail = async (post: Post) => {
    setDetailPost(post); setDetailModal(true);
    setComments([]); setCommentLikedIds(new Set()); setReplyingTo(null);
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true });
    const loaded: Comment[] = data ?? [];
    setComments(loaded);
    if (currentUserId && loaded.length > 0) {
      const { data: likeData } = await supabase
        .from('comment_likes').select('comment_id')
        .eq('user_id', currentUserId)
        .in('comment_id', loaded.map(c => c.id));
      if (likeData) setCommentLikedIds(new Set(likeData.map((r: any) => r.comment_id)));
    }
    setLoadingComments(false);
  };

  const closeDetail = () => {
    setDetailModal(false); setDetailPost(null);
    setComments([]); setCommentText(''); setReplyingTo(null);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !detailPost) return;
    setSendingComment(true);
    const user = await getCurrentUser();
    const nickname = user ? await getNickname(user.id, user.user_metadata?.nickname ?? '학생') : '학생';
    const { data, error } = await supabase.from('comments').insert({
      post_id: detailPost.id,
      parent_id: replyingTo?.id ?? null,
      author_id: user?.id ?? null,
      author_nickname: nickname,
      body: commentText.trim(),
    }).select().single();
    setSendingComment(false);
    if (!error && data) {
      setComments(prev => [...prev, data]);
      setPosts(prev => prev.map(p => p.id === detailPost.id ? { ...p, comment_count: p.comment_count + 1 } : p));
      setDetailPost(p => p ? { ...p, comment_count: p.comment_count + 1 } : p);
      setCommentText(''); setReplyingTo(null);
    }
  };

  const topComments = comments.filter(c => !c.parent_id);
  const getReplies = (id: string) => comments.filter(c => c.parent_id === id);
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
          <View style={styles.empty}><ActivityIndicator color="#7c6fff" size="large" /></View>
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
            <TouchableOpacity key={post.id}
              style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openDetail(post)} activeOpacity={0.8}>
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
              <Text style={[styles.postBody, { color: colors.subText }]} numberOfLines={2}>{post.body}</Text>
              <View style={[styles.postFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.postAction} onPress={() => toggleLike(post)}>
                  <Text style={styles.postActionIcon}>{likedIds.has(post.id) ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.postActionText, { color: colors.subText }, likedIds.has(post.id) && styles.likedText]}>{post.likes}</Text>
                </TouchableOpacity>
                <View style={styles.postAction}>
                  <Text style={styles.postActionIcon}>💬</Text>
                  <Text style={[styles.postActionText, { color: colors.subText }]}>{post.comment_count}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 상세 뷰 */}
      <Modal visible={detailModal} animationType="slide" onRequestClose={closeDetail}>
        <KeyboardAvoidingView
          style={[styles.detailContainer, { backgroundColor: colors.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeDetail} style={styles.detailBack}>
              <Text style={[styles.detailBackText, { color: colors.text }]}>← 뒤로</Text>
            </TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: colors.text }]}>게시글</Text>
            <TouchableOpacity
              onPress={() => detailPost && Share.share({ message: `[${detailPost.tab}] ${detailPost.title}\n\n${detailPost.body}` })}
              style={styles.detailShare}>
              <Text style={{ color: colors.subText, fontSize: 13 }}>공유 ↗</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {detailPost && (
              <>
                <View style={[styles.detailContent, { borderBottomColor: colors.border }]}>
                  <View style={styles.detailMeta}>
                    <View style={[styles.postEmojiBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={styles.postEmoji}>{TAB_EMOJIS[detailPost.tab] ?? '📝'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.postAuthor, { color: colors.text }]}>
                        {isAnonPost(detailPost) ? '익명1' : detailPost.author_nickname}
                      </Text>
                      <Text style={[styles.postTime, { color: colors.subText }]}>{timeAgo(detailPost.created_at)}</Text>
                    </View>
                    <View style={[styles.postTabBadge, { backgroundColor: colors.accent + '18' }]}>
                      <Text style={[styles.postTabText, { color: colors.accent }]}>{detailPost.tab}</Text>
                    </View>
                  </View>
                  <Text style={[styles.detailTitle, { color: colors.text }]}>{detailPost.title}</Text>
                  <Text style={[styles.detailBody, { color: colors.text }]}>{detailPost.body}</Text>
                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={[styles.likeBtn, likedIds.has(detailPost.id) && styles.likeBtnActive]}
                      onPress={() => toggleLike(detailPost)}>
                      <Text style={styles.likeBtnIcon}>{likedIds.has(detailPost.id) ? '❤️' : '🤍'}</Text>
                      <Text style={[styles.likeBtnText, likedIds.has(detailPost.id) && { color: '#ff6b6b' }]}>{detailPost.likes}</Text>
                    </TouchableOpacity>
                    <View style={styles.commentCount}>
                      <Text style={{ fontSize: 16 }}>💬</Text>
                      <Text style={[styles.commentCountText, { color: colors.subText }]}>{detailPost.comment_count}</Text>
                    </View>
                  </View>
                </View>

                {/* 댓글 */}
                <View style={styles.commentsSection}>
                  <Text style={[styles.commentsSectionTitle, { color: colors.text }]}>댓글 {topComments.length}개</Text>
                  {loadingComments ? (
                    <ActivityIndicator color="#7c6fff" style={{ marginTop: 20 }} />
                  ) : topComments.length === 0 ? (
                    <Text style={[styles.noComment, { color: colors.subText }]}>첫 댓글을 남겨보세요!</Text>
                  ) : (
                    topComments.map(c => {
                      const replies = getReplies(c.id);
                      return (
                        <View key={c.id}>
                          {/* 댓글 */}
                          <View style={[styles.commentItem, { borderBottomColor: colors.border }]}>
                            <View style={styles.commentTop}>
                              <Text style={styles.commentAuthor}>{getAnonName(c.author_id, c.author_nickname)}</Text>
                              <Text style={[styles.commentTime, { color: colors.subText }]}>{timeAgo(c.created_at)}</Text>
                            </View>
                            <Text style={[styles.commentText, { color: colors.text }]}>{c.body}</Text>
                            <View style={styles.commentActions}>
                              <TouchableOpacity style={styles.commentAction} onPress={() => toggleCommentLike(c)}>
                                <Text style={styles.commentActionIcon}>{commentLikedIds.has(c.id) ? '❤️' : '🤍'}</Text>
                                <Text style={[styles.commentActionText, { color: commentLikedIds.has(c.id) ? '#ff6b6b' : colors.subText }]}>{c.likes}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.commentAction} onPress={() => {
                                setReplyingTo(replyingTo?.id === c.id ? null : c);
                                setCommentText('');
                              }}>
                                <Text style={[styles.commentActionText, { color: replyingTo?.id === c.id ? colors.accent : colors.subText }]}>
                                  {replyingTo?.id === c.id ? '취소' : '답글'}
                                </Text>
                              </TouchableOpacity>
                              {replies.length > 0 && (
                                <Text style={[styles.commentActionText, { color: colors.subText }]}>답글 {replies.length}개</Text>
                              )}
                            </View>
                          </View>

                          {/* 답글 */}
                          {replies.map(r => (
                            <View key={r.id} style={[styles.replyItem, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                              <View style={styles.replyLine} />
                              <View style={{ flex: 1 }}>
                                <View style={styles.commentTop}>
                                  <Text style={[styles.commentAuthor, { fontSize: 12 }]}>{getAnonName(r.author_id, r.author_nickname)}</Text>
                                  <Text style={[styles.commentTime, { color: colors.subText }]}>{timeAgo(r.created_at)}</Text>
                                </View>
                                <Text style={[styles.commentText, { color: colors.text, fontSize: 13 }]}>{r.body}</Text>
                                <View style={styles.commentActions}>
                                  <TouchableOpacity style={styles.commentAction} onPress={() => toggleCommentLike(r)}>
                                    <Text style={styles.commentActionIcon}>{commentLikedIds.has(r.id) ? '❤️' : '🤍'}</Text>
                                    <Text style={[styles.commentActionText, { color: commentLikedIds.has(r.id) ? '#ff6b6b' : colors.subText }]}>{r.likes}</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* 답글 표시 */}
          {replyingTo && (
            <View style={[styles.replyingBanner, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Text style={[styles.replyingText, { color: colors.subText }]}>
                <Text style={{ color: colors.accent }}>@{getAnonName(replyingTo.author_id, replyingTo.author_nickname)}</Text>에게 답글
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }}>
                <Text style={{ color: colors.subText, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 댓글 입력 */}
          <View style={[styles.commentInputRow, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
            <TextInput
              style={[styles.commentInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder={replyingTo ? `@${getAnonName(replyingTo.author_id, replyingTo.author_nickname)}에게 답글...` : '댓글을 입력하세요'}
              placeholderTextColor={colors.subText}
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
        </KeyboardAvoidingView>
      </Modal>

      {/* 글쓰기 모달 */}
      <Modal visible={writeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>글쓰기</Text>
              <TouchableOpacity onPress={() => setWriteModal(false)}>
                <Text style={[styles.modalClose, { color: colors.subText }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TABS.filter(t => t !== '전체').map(tab => (
                  <TouchableOpacity key={tab}
                    style={[styles.tabChip, { backgroundColor: colors.bg, borderColor: colors.border }, writeTab === tab && styles.tabChipActive]}
                    onPress={() => setWriteTab(tab)}>
                    <Text style={[styles.tabText, { color: colors.subText }, writeTab === tab && styles.tabTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={[styles.titleInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              placeholder="제목을 입력하세요" placeholderTextColor={colors.subText}
              value={writeTitle} onChangeText={setWriteTitle} maxLength={50} />
            <TextInput
              style={[styles.bodyInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              placeholder="내용을 입력하세요" placeholderTextColor={colors.subText}
              value={writeBody} onChangeText={setWriteBody} multiline textAlignVertical="top" />
            {postError ? <Text style={styles.postErrorText}>{postError}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, (!writeTitle.trim() || !writeBody.trim() || submitting) && styles.submitBtnDisabled]}
              onPress={submitPost} disabled={!writeTitle.trim() || !writeBody.trim() || submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>등록하기</Text>}
            </TouchableOpacity>
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
  tabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
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

  postCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postEmojiBox: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
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

  // 상세 뷰
  detailContainer: { flex: 1 },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  detailBack: { padding: 4 },
  detailBackText: { fontSize: 15, fontWeight: '600' },
  detailHeaderTitle: { fontSize: 16, fontWeight: '800' },
  detailShare: { padding: 4 },
  detailScroll: { flex: 1 },
  detailContent: { padding: 20, borderBottomWidth: 1 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 20, fontWeight: '900', marginBottom: 12, lineHeight: 28 },
  detailBody: { fontSize: 15, lineHeight: 24, marginBottom: 20 },
  detailActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ff6b6b18', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#ff6b6b33',
  },
  likeBtnActive: { backgroundColor: '#ff6b6b22', borderColor: '#ff6b6b88' },
  likeBtnIcon: { fontSize: 18 },
  likeBtnText: { fontSize: 15, fontWeight: '700', color: '#aaa' },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentCountText: { fontSize: 15, fontWeight: '600' },

  commentsSection: { padding: 20 },
  commentsSectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
  noComment: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },

  commentItem: { paddingVertical: 12, borderBottomWidth: 1 },
  commentTop: { flexDirection: 'row', gap: 8, marginBottom: 5, alignItems: 'center' },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#a78bfa' },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  commentActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  commentAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionIcon: { fontSize: 13 },
  commentActionText: { fontSize: 12, fontWeight: '600' },

  replyItem: {
    flexDirection: 'row', paddingVertical: 10, paddingLeft: 16,
    paddingRight: 16, borderBottomWidth: 1, marginLeft: 20,
  },
  replyLine: {
    width: 2, borderRadius: 1, backgroundColor: '#7c6fff55',
    marginRight: 12, alignSelf: 'stretch',
  },

  replyingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1,
  },
  replyingText: { fontSize: 13 },

  commentInputRow: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  commentInput: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 13,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7c6fff', alignItems: 'center', justifyContent: 'center',
  },
  commentSendBtnDisabled: { backgroundColor: '#2a2a40' },
  commentSendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalClose: { fontSize: 18 },
  titleInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  bodyInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, height: 140, marginBottom: 16 },
  submitBtn: { backgroundColor: '#7c6fff', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: '#2a2a40' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  postErrorText: { fontSize: 12, color: '#ff6b6b', marginBottom: 8, textAlign: 'center' },
});
