const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
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
  chapter: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  objectives: [{
    type: String
  }],
  keyTerms: [{
    term: String,
    definition: String
  }],
  examples: [{
    title: String,
    description: String,
    solution: String
  }],
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate'
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 30
  },
  resources: [{
    type: String,
    url: String,
    description: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

lessonSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Lesson', lessonSchema);
