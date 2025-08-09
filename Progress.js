const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Literature', 'Computer Science']
  },
  lessonsCompleted: [{
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    timeSpent: Number, // in minutes
    score: Number // percentage
  }],
  quizzesCompleted: [{
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    score: Number,
    totalQuestions: Number,
    correctAnswers: Number,
    completedAt: {
      type: Date,
      default: Date.now
    },
    timeSpent: Number
  }],
  strengths: [{
    topic: String,
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    lastAssessed: {
      type: Date,
      default: Date.now
    }
  }],
  weaknesses: [{
    topic: String,
    difficulty: {
      type: Number,
      min: 0,
      max: 100
    },
    lastAssessed: {
      type: Date,
      default: Date.now
    },
    improvementSuggestions: [String]
  }],
  overallProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  studyStreak: {
    type: Number,
    default: 0
  },
  totalStudyTime: {
    type: Number,
    default: 0 // in minutes
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  badges: [{
    name: String,
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate overall progress based on completed lessons and quiz scores
progressSchema.methods.calculateOverallProgress = function() {
  if (this.lessonsCompleted.length === 0 && this.quizzesCompleted.length === 0) {
    return 0;
  }
  
  let totalScore = 0;
  let totalItems = 0;
  
  // Add lesson scores
  this.lessonsCompleted.forEach(lesson => {
    if (lesson.score) {
      totalScore += lesson.score;
      totalItems++;
    }
  });
  
  // Add quiz scores
  this.quizzesCompleted.forEach(quiz => {
    totalScore += quiz.score;
    totalItems++;
  });
  
  return totalItems > 0 ? Math.round(totalScore / totalItems) : 0;
};

progressSchema.pre('save', function(next) {
  this.overallProgress = this.calculateOverallProgress();
  this.lastActivity = Date.now();
  next();
});

module.exports = mongoose.model('Progress', progressSchema);
