import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Stats = {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  totalMessages: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalPosts: 0, totalComments: 0, totalMessages: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [usersRes, postsRes, commentsRes, msgsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
    ]);
    setStats({
      totalUsers: usersRes.count ?? 0,
      totalPosts: postsRes.count ?? 0,
      totalComments: commentsRes.count ?? 0,
      totalMessages: msgsRes.count ?? 0,
    });
  };

  const STAT_CARDS = [
    { label: '전체 사용자', value: stats.totalUsers, icon: '👤', color: '#7c6fff' },
    { label: '전체 게시글', value: stats.totalPosts, icon: '📝', color: '#06b6d4' },
    { label: '전체 댓글', value: stats.totalComments, icon: '💬', color: '#10b981' },
    { label: '채팅 메시지', value: stats.totalMessages, icon: '✉️', color: '#f59e0b' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>관리자 대시보드</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {STAT_CARDS.map((card) => (
            <View key={card.label} style={[styles.statCard, { borderColor: card.color + '40' }]}>
              <Text style={styles.statIcon}>{card.icon}</Text>
              <Text style={[styles.statValue, { color: card.color }]}>{card.value.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>관리 메뉴</Text>

        <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/users' as any)}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>👤</Text>
            <View>
              <Text style={styles.menuTitle}>사용자 관리</Text>
              <Text style={styles.menuDesc}>회원 목록 조회 및 관리자 권한 설정</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/admin/posts' as any)}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>📝</Text>
            <View>
              <Text style={styles.menuTitle}>게시글 관리</Text>
              <Text style={styles.menuDesc}>게시글 조회 및 삭제</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070d' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 55, paddingBottom: 16,
  },
  backBtn: { paddingRight: 8 },
  backText: { color: '#7c6fff', fontSize: 14 },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: '#eee' },
  adminBadge: {
    backgroundColor: '#7c6fff22', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#7c6fff',
  },
  adminBadgeText: { fontSize: 10, color: '#7c6fff', fontWeight: '900' },

  content: { flex: 1, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#13131a', borderRadius: 16,
    borderWidth: 1, padding: 16, alignItems: 'center', gap: 6,
  },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#888' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12 },
  menuCard: {
    backgroundColor: '#13131a', borderRadius: 16,
    borderWidth: 1, borderColor: '#1e1e30',
    padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuIcon: { fontSize: 24 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#eee', marginBottom: 2 },
  menuDesc: { fontSize: 12, color: '#666' },
  menuArrow: { fontSize: 20, color: '#444' },
});
