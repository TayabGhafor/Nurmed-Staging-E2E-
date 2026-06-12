import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface EncounterStats {
  doctorName: string;
  doctorId: number;
  encounterCount: number;
  avgDuration: string;
  totalDuration: string;
  lastEncounter: string;
  department: string;
}

export interface EncounterAnalytics {
  totalEncounters: number;
  avgEncountersPerDoctor: number;
  avgConsultationTime: string;
  totalConsultationTime: string;
  encountersPerUser: EncounterStats[];
  departmentDistribution: { [key: string]: number };
  timeDistribution: { [key: string]: number };
}

export interface EncounterDetail {
  id: number;
  patientMrn: string;
  doctorName: string;
  doctorId: number;
  department: string;
  date: string;
  startTime: string;
  duration: string;
  status: string;
  language: string;
  sessionTemplate: string;
  notesGenerated: boolean;
  createdAt: string;
}

export const useEncounterAnalytics = (dateRange: string = 'week', department: string = 'all') => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<EncounterAnalytics | null>(null);
  const [encounters, setEncounters] = useState<EncounterDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateFilter = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today.toISOString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString();
      case 'quarter':
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return quarterAgo.toISOString();
      default:
        return new Date(0).toISOString();
    }
  };

  const calculateDuration = (createdAt: string, updatedAt: string) => {
    const start = new Date(createdAt);
    const end = new Date(updatedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  };

  const getTimeOfDay = (dateString: string) => {
    const hour = new Date(dateString).getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated and has hospital_id
      if (!user || !user.hospital_id) {
        setError('User not authenticated or hospital ID not found');
        setLoading(false);
        return;
      }

      const dateFilter = getDateFilter(dateRange);
      
      console.log('🔍 Fetching sessions for hospital_id:', user.hospital_id);
      
      // Now fetch sessions with doctor and hospital information, filtered by hospital_id
      const { data: sessions, error: sessionsError } = await supabase
        .from('session')
        .select(`
          id,
          mrn,
          doctor_id,
          hospital_id,
          created_at,
          updated_at,
          status,
          language,
          session_template_id,
          doctor:doctor_id (
            id,
            first_name,
            last_name,
            department
          ),
          hospital:hospital_id (
            id,
            name
          ),
          sessiontemplate:session_template_id (
            id,
            name
          )
        `)
        .eq('hospital_id', user.hospital_id)
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false });

      console.log('📊 Sessions found:', sessions?.length || 0);

      if (sessionsError) {
        throw sessionsError;
      }

      if (!sessions || sessions.length === 0) {
        setAnalytics({
          totalEncounters: 0,
          avgEncountersPerDoctor: 0,
          avgConsultationTime: '0 min',
          totalConsultationTime: '0 min',
          encountersPerUser: [],
          departmentDistribution: {},
          timeDistribution: {}
        });
        setEncounters([]);
        setLoading(false);
        return;
      }

      // Process sessions data
      const processedSessions = sessions.map(session => {
        // Handle joined data - Supabase returns arrays for foreign key relationships
        const doctor = Array.isArray(session.doctor) ? session.doctor[0] : session.doctor;
        const sessiontemplate = Array.isArray(session.sessiontemplate) ? session.sessiontemplate[0] : session.sessiontemplate;
        
        return {
          id: session.id,
          patientMrn: session.mrn,
          doctorName: doctor 
            ? `${doctor.first_name} ${doctor.last_name}` 
            : 'Unknown Doctor',
          doctorId: session.doctor_id,
          department: doctor?.department || 'Unknown',
          date: new Date(session.created_at).toLocaleDateString(),
          startTime: new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: calculateDuration(session.created_at, session.updated_at),
          status: session.status,
          language: session.language,
          sessionTemplate: sessiontemplate?.name || 'Unknown',
          notesGenerated: session.status === 'Completed',
          createdAt: session.created_at
        };
      });

      // Filter by department if specified
      const filteredSessions = department === 'all' 
        ? processedSessions 
        : processedSessions.filter(session => 
            session.department.toLowerCase() === department.toLowerCase()
          );

      setEncounters(filteredSessions || []);

      // Calculate analytics
      const totalEncounters = filteredSessions?.length || 0;
      
      // Group by doctor
      const doctorStats: { [key: number]: EncounterStats } = {};
      const departmentCounts: { [key: string]: number } = {};
      const timeCounts: { [key: string]: number } = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      
      let totalDurationMs = 0;

      filteredSessions?.forEach(session => {
        // Doctor stats
        if (!doctorStats[session.doctorId]) {
          doctorStats[session.doctorId] = {
            doctorName: session.doctorName,
            doctorId: session.doctorId,
            encounterCount: 0,
            avgDuration: '0 min',
            totalDuration: '0 min',
            lastEncounter: session.createdAt,
            department: session.department
          };
        }
        
        doctorStats[session.doctorId].encounterCount++;
        doctorStats[session.doctorId].lastEncounter = session.createdAt;
        
        // Department counts
        departmentCounts[session.department] = (departmentCounts[session.department] || 0) + 1;
        
        // Time distribution
        const timeOfDay = getTimeOfDay(session.createdAt);
        timeCounts[timeOfDay]++;
        
        // Duration calculation
        const durationMs = new Date(session.createdAt).getTime() - new Date(session.createdAt).getTime();
        totalDurationMs += durationMs;
      });

      // Calculate doctor averages and totals
      const encountersPerUser = Object.values(doctorStats).map(doctor => {
        const avgDurationMs = totalDurationMs / doctor.encounterCount;
        const avgMinutes = Math.round(avgDurationMs / (1000 * 60));
        const totalMinutes = Math.round(totalDurationMs / (1000 * 60));
        
        return {
          ...doctor,
          avgDuration: avgMinutes < 60 ? `${avgMinutes} min` : `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`,
          totalDuration: totalMinutes < 60 ? `${totalMinutes} min` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
          lastEncounter: formatTimeAgo(doctor.lastEncounter)
        };
      });

      const avgEncountersPerDoctor = totalEncounters > 0 ? totalEncounters / encountersPerUser.length : 0;
      const avgConsultationTimeMs = totalEncounters > 0 ? totalDurationMs / totalEncounters : 0;
      const avgMinutes = Math.round(avgConsultationTimeMs / (1000 * 60));
      const avgConsultationTime = avgMinutes < 60 ? `${avgMinutes} min` : `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`;
      
      const totalMinutes = Math.round(totalDurationMs / (1000 * 60));
      const totalConsultationTime = totalMinutes < 60 ? `${totalMinutes} min` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

      // Calculate time distribution percentages
      const totalTimeCount = Object.values(timeCounts).reduce((sum, count) => sum + count, 0);
      const timeDistribution = {
        morning: totalTimeCount > 0 ? Math.round((timeCounts.morning / totalTimeCount) * 100) : 0,
        afternoon: totalTimeCount > 0 ? Math.round((timeCounts.afternoon / totalTimeCount) * 100) : 0,
        evening: totalTimeCount > 0 ? Math.round((timeCounts.evening / totalTimeCount) * 100) : 0,
        night: totalTimeCount > 0 ? Math.round((timeCounts.night / totalTimeCount) * 100) : 0
      };

      setAnalytics({
        totalEncounters,
        avgEncountersPerDoctor: Math.round(avgEncountersPerDoctor * 10) / 10,
        avgConsultationTime,
        totalConsultationTime,
        encountersPerUser,
        departmentDistribution: departmentCounts,
        timeDistribution
      });

    } catch (err) {
      console.error('Error fetching encounter analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.hospital_id) {
      fetchAnalytics();
    }
  }, [dateRange, department, user]);

  return {
    analytics,
    encounters,
    loading,
    error,
    refetch: fetchAnalytics
  };
};
