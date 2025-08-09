const mongoose = require('mongoose');

const teacherTipSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  tipType: {
    type: String,
    enum: ['study-method', 'concept-clarification', 'practice-suggestion', 'motivation', 'time-management', 'general'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  relatedTopic: String,
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  resources: [{
    title: String,
    url: String,
    type: String // 'video', 'article', 'exercise', 'book'
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  studentResponse: {
    feedback: String,
    helpful: Boolean,
    respondedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TeacherTip', teacherTipSchema);
