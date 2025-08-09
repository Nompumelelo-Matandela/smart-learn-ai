const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Literature', 'Computer Science']
  },
  grade: {
    type: Number,
    required: true,
    min: 9,
    max: 12
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay'],
      required: true
    },
    options: [String], // For multiple choice questions
    correctAnswer: {
      type: String,
      required: true
    },
    explanation: String,
    points: {
      type: Number,
      default: 1
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium'
    }
  }],
  timeLimit: {
    type: Number, // in minutes
    default: 30
  },
  passingScore: {
    type: Number,
    default: 70 // percentage
  },
  attempts: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    answers: [{
      questionIndex: Number,
      answer: String,
      isCorrect: Boolean,
      timeSpent: Number
    }],
    score: Number,
    startedAt: Date,
    completedAt: Date,
    passed: Boolean
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate quiz score
quizSchema.methods.calculateScore = function(answers) {
  let correctAnswers = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  
  this.questions.forEach((question, index) => {
    totalPoints += question.points;
    const studentAnswer = answers.find(a => a.questionIndex === index);
    
    if (studentAnswer && studentAnswer.answer === question.correctAnswer) {
      correctAnswers++;
      earnedPoints += question.points;
    }
  });
  
  return {
    score: Math.round((earnedPoints / totalPoints) * 100),
    correctAnswers,
    totalQuestions: this.questions.length,
    earnedPoints,
    totalPoints
  };
};

module.exports = mongoose.model('Quiz', quizSchema);
