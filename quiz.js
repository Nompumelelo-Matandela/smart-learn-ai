const express = require('express');
const Quiz = require('../models/Quiz');
const Progress = require('../models/Progress');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get all quizzes for a subject and grade
router.get('/:subject/:grade', authenticateToken, async (req, res) => {
  try {
    const { subject, grade } = req.params;
    
    const quizzes = await Quiz.find({ 
      subject, 
      grade: parseInt(grade),
      isActive: true 
    })
    .populate('createdBy', 'name')
    .populate('lesson', 'title')
    .sort({ createdAt: -1 });

    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific quiz
router.get('/detail/:id', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('lesson', 'title');
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Remove correct answers from questions for students
    if (req.user.role === 'student') {
      const sanitizedQuiz = {
        ...quiz.toObject(),
        questions: quiz.questions.map(q => ({
          question: q.question,
          type: q.type,
          options: q.options,
          points: q.points,
          difficulty: q.difficulty
        }))
      };
      res.json(sanitizedQuiz);
    } else {
      res.json(quiz);
    }
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit quiz answers
router.post('/submit/:id', authenticateToken, async (req, res) => {
  try {
    const { answers, startTime } = req.body;
    const quizId = req.params.id;
    const studentId = req.user.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Calculate score
    const result = quiz.calculateScore(answers);
    const completedAt = new Date();
    const timeSpent = Math.round((completedAt - new Date(startTime)) / 60000); // minutes

    // Add attempt to quiz
    const attempt = {
      student: studentId,
      answers: answers.map((answer, index) => ({
        questionIndex: index,
        answer: answer.answer,
        isCorrect: answer.answer === quiz.questions[index].correctAnswer,
        timeSpent: answer.timeSpent || 0
      })),
      score: result.score,
      startedAt: new Date(startTime),
      completedAt,
      passed: result.score >= quiz.passingScore
    };

    quiz.attempts.push(attempt);
    await quiz.save();

    // Update student progress
    let progress = await Progress.findOne({ 
      student: studentId, 
      subject: quiz.subject 
    });

    if (!progress) {
      progress = new Progress({
        student: studentId,
        subject: quiz.subject
      });
    }

    // Add quiz completion to progress
    progress.quizzesCompleted.push({
      quiz: quizId,
      score: result.score,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      completedAt,
      timeSpent
    });

    // Update study time
    progress.totalStudyTime += timeSpent;

    // Update strengths and weaknesses based on performance
    quiz.questions.forEach((question, index) => {
      const studentAnswer = answers[index];
      const isCorrect = studentAnswer.answer === question.correctAnswer;
      
      // This is a simplified topic extraction - in a real app, you'd have more sophisticated topic mapping
      const topic = question.question.split(' ').slice(0, 3).join(' ');
      
      if (isCorrect) {
        // Update or add strength
        const existingStrength = progress.strengths.find(s => s.topic === topic);
        if (existingStrength) {
          existingStrength.confidence = Math.min(100, existingStrength.confidence + 10);
          existingStrength.lastAssessed = new Date();
        } else {
          progress.strengths.push({
            topic,
            confidence: 70,
            lastAssessed: new Date()
          });
        }
      } else {
        // Update or add weakness
        const existingWeakness = progress.weaknesses.find(w => w.topic === topic);
        if (existingWeakness) {
          existingWeakness.difficulty = Math.min(100, existingWeakness.difficulty + 15);
          existingWeakness.lastAssessed = new Date();
        } else {
          progress.weaknesses.push({
            topic,
            difficulty: 80,
            lastAssessed: new Date(),
            improvementSuggestions: [
              'Review the lesson material for this topic',
              'Practice more questions on this concept',
              'Ask your teacher for clarification'
            ]
          });
        }
      }
    });

    await progress.save();

    res.json({
      message: 'Quiz submitted successfully',
      result: {
        ...result,
        passed: result.score >= quiz.passingScore,
        timeSpent
      },
      progress
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new quiz (teachers only)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can create quizzes' });
    }

    const {
      title,
      subject,
      grade,
      lesson,
      questions,
      timeLimit,
      passingScore
    } = req.body;

    const quiz = new Quiz({
      title,
      subject,
      grade,
      lesson,
      questions,
      timeLimit,
      passingScore,
      createdBy: req.user.userId
    });

    await quiz.save();

    res.status(201).json({ message: 'Quiz created successfully', quiz });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get quiz results for a student
router.get('/results/:studentId/:subject', authenticateToken, async (req, res) => {
  try {
    const { studentId, subject } = req.params;
    
    // Check if requester is the student themselves or a teacher
    if (req.user.userId !== studentId && req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const progress = await Progress.findOne({ 
      student: studentId, 
      subject 
    }).populate('quizzesCompleted.quiz', 'title');

    if (!progress) {
      return res.json({ quizzesCompleted: [] });
    }

    res.json({
      quizzesCompleted: progress.quizzesCompleted,
      overallProgress: progress.overallProgress,
      strengths: progress.strengths,
      weaknesses: progress.weaknesses
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
