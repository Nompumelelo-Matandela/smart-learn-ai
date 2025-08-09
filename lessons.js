const express = require('express');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get all lessons for a subject and grade
router.get('/:subject/:grade', authenticateToken, async (req, res) => {
  try {
    const { subject, grade } = req.params;
    
    const lessons = await Lesson.find({ 
      subject, 
      grade: parseInt(grade) 
    })
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

    res.json(lessons);
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific lesson
router.get('/detail/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark lesson as completed
router.post('/complete/:id', authenticateToken, async (req, res) => {
  try {
    const { timeSpent, score } = req.body;
    const lessonId = req.params.id;
    const studentId = req.user.userId;

    // Get the lesson to find its subject
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Find or create progress record
    let progress = await Progress.findOne({ 
      student: studentId, 
      subject: lesson.subject 
    });

    if (!progress) {
      progress = new Progress({
        student: studentId,
        subject: lesson.subject
      });
    }

    // Check if lesson already completed
    const existingCompletion = progress.lessonsCompleted.find(
      lc => lc.lesson.toString() === lessonId
    );

    if (existingCompletion) {
      // Update existing completion
      existingCompletion.timeSpent = timeSpent;
      existingCompletion.score = score;
      existingCompletion.completedAt = new Date();
    } else {
      // Add new completion
      progress.lessonsCompleted.push({
        lesson: lessonId,
        timeSpent,
        score,
        completedAt: new Date()
      });
    }

    // Update total study time
    progress.totalStudyTime += timeSpent || 0;

    await progress.save();

    res.json({ message: 'Lesson marked as completed', progress });
  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new lesson (teachers only)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    // Check if user is a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can create lessons' });
    }

    const {
      title,
      subject,
      grade,
      chapter,
      content,
      objectives,
      keyTerms,
      examples,
      difficulty,
      estimatedTime,
      resources
    } = req.body;

    const lesson = new Lesson({
      title,
      subject,
      grade,
      chapter,
      content,
      objectives,
      keyTerms,
      examples,
      difficulty,
      estimatedTime,
      resources,
      createdBy: req.user.userId
    });

    await lesson.save();

    res.status(201).json({ message: 'Lesson created successfully', lesson });
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get lessons by subject for student dashboard
router.get('/dashboard/:subject', authenticateToken, async (req, res) => {
  try {
    const { subject } = req.params;
    const studentId = req.user.userId;

    // Get student's grade from user profile
    const User = require('../models/User');
    const user = await User.findById(studentId);
    
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get lessons for the subject and grade
    const lessons = await Lesson.find({ 
      subject, 
      grade: user.grade 
    }).sort({ createdAt: -1 });

    // Get progress for this subject
    const progress = await Progress.findOne({ 
      student: studentId, 
      subject 
    });

    // Mark which lessons are completed
    const lessonsWithProgress = lessons.map(lesson => {
      const completed = progress?.lessonsCompleted.find(
        lc => lc.lesson.toString() === lesson._id.toString()
      );
      
      return {
        ...lesson.toObject(),
        isCompleted: !!completed,
        completionData: completed || null
      };
    });

    res.json({
      lessons: lessonsWithProgress,
      progress: progress || null
    });
  } catch (error) {
    console.error('Error fetching dashboard lessons:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
