const express = require('express');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get student profile with progress
router.get('/student/:id?', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id || req.user.userId;
    
    // Check if requester can access this profile
    if (req.user.userId !== studentId && req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const student = await User.findById(studentId).select('-password');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get progress for all subjects
    const progressRecords = await Progress.find({ student: studentId })
      .populate('lessonsCompleted.lesson', 'title subject')
      .populate('quizzesCompleted.quiz', 'title subject');

    // Calculate overall statistics
    let totalLessons = 0;
    let totalQuizzes = 0;
    let totalStudyTime = 0;
    let overallScore = 0;
    let subjectProgress = {};

    progressRecords.forEach(progress => {
      totalLessons += progress.lessonsCompleted.length;
      totalQuizzes += progress.quizzesCompleted.length;
      totalStudyTime += progress.totalStudyTime;
      
      // Calculate average score for this subject
      const quizScores = progress.quizzesCompleted.map(q => q.score);
      const avgScore = quizScores.length > 0 
        ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length 
        : 0;

      subjectProgress[progress.subject] = {
        lessonsCompleted: progress.lessonsCompleted.length,
        quizzesCompleted: progress.quizzesCompleted.length,
        averageScore: Math.round(avgScore),
        overallProgress: progress.overallProgress,
        strengths: progress.strengths,
        weaknesses: progress.weaknesses,
        studyTime: progress.totalStudyTime,
        badges: progress.badges
      };
    });

    // Calculate overall average score
    const allQuizScores = progressRecords.flatMap(p => p.quizzesCompleted.map(q => q.score));
    overallScore = allQuizScores.length > 0 
      ? Math.round(allQuizScores.reduce((a, b) => a + b, 0) / allQuizScores.length)
      : 0;

    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        grade: student.grade,
        subjects: student.subjects,
        profilePicture: student.profilePicture,
        lastLogin: student.lastLogin,
        createdAt: student.createdAt
      },
      statistics: {
        totalLessons,
        totalQuizzes,
        totalStudyTime,
        overallScore,
        subjectProgress
      },
      progressRecords
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student profile
router.put('/update', authenticateToken, async (req, res) => {
  try {
    const { name, subjects, profilePicture } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields
    if (name) user.name = name;
    if (profilePicture) user.profilePicture = profilePicture;
    
    // Handle subjects update for students
    if (subjects && user.role === 'student') {
      const oldSubjects = user.subjects;
      user.subjects = subjects;
      
      // Create progress records for new subjects
      const newSubjects = subjects.filter(s => !oldSubjects.includes(s));
      for (const subject of newSubjects) {
        const existingProgress = await Progress.findOne({ 
          student: userId, 
          subject 
        });
        
        if (!existingProgress) {
          const progress = new Progress({
            student: userId,
            subject
          });
          await progress.save();
        }
      }
    }

    await user.save();

    res.json({ 
      message: 'Profile updated successfully', 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        subjects: user.subjects,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard for a subject
router.get('/leaderboard/:subject', authenticateToken, async (req, res) => {
  try {
    const { subject } = req.params;
    
    const progressRecords = await Progress.find({ subject })
      .populate('student', 'name grade')
      .sort({ overallProgress: -1 })
      .limit(10);

    const leaderboard = progressRecords.map((progress, index) => ({
      rank: index + 1,
      student: {
        name: progress.student.name,
        grade: progress.student.grade
      },
      overallProgress: progress.overallProgress,
      totalStudyTime: progress.totalStudyTime,
      lessonsCompleted: progress.lessonsCompleted.length,
      quizzesCompleted: progress.quizzesCompleted.length,
      badges: progress.badges.length
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get study analytics for a student
router.get('/analytics/:timeframe?', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.userId;
    const timeframe = req.params.timeframe || '30'; // days
    const daysAgo = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const progressRecords = await Progress.find({ student: studentId });

    let analytics = {
      studyTimeBySubject: {},
      quizPerformanceOverTime: [],
      strengthsAndWeaknesses: {
        strengths: [],
        weaknesses: []
      },
      dailyActivity: {}
    };

    progressRecords.forEach(progress => {
      // Study time by subject
      analytics.studyTimeBySubject[progress.subject] = progress.totalStudyTime;

      // Quiz performance over time (within timeframe)
      const recentQuizzes = progress.quizzesCompleted.filter(
        quiz => quiz.completedAt >= startDate
      );
      
      recentQuizzes.forEach(quiz => {
        analytics.quizPerformanceOverTime.push({
          date: quiz.completedAt,
          subject: progress.subject,
          score: quiz.score
        });
      });

      // Collect strengths and weaknesses
      analytics.strengthsAndWeaknesses.strengths.push(...progress.strengths);
      analytics.strengthsAndWeaknesses.weaknesses.push(...progress.weaknesses);

      // Daily activity
      [...progress.lessonsCompleted, ...progress.quizzesCompleted].forEach(activity => {
        const date = activity.completedAt.toDateString();
        if (!analytics.dailyActivity[date]) {
          analytics.dailyActivity[date] = { lessons: 0, quizzes: 0, studyTime: 0 };
        }
        
        if (activity.lesson) {
          analytics.dailyActivity[date].lessons++;
        } else {
          analytics.dailyActivity[date].quizzes++;
        }
        analytics.dailyActivity[date].studyTime += activity.timeSpent || 0;
      });
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
