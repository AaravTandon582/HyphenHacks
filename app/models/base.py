from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Grade(Base):
    __tablename__ = 'grades'
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey('students.id'))
    course_id = Column(Integer, ForeignKey('courses.id'))
    grade = Column(Float)

class GpaRecord(Base):
    __tablename__ = 'gpa_records'
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey('students.id'))
    semester = Column(String)
    gpa = Column(Float)

class AgentRun(Base):
    __tablename__ = 'agent_runs'
    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey('agents.id'))
    run_date = Column(DateTime)
    status = Column(String)

class DailyRequirement(Base):
    __tablename__ = 'daily_requirements'
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey('students.id'))
    requirement_type = Column(String)
    completed_at = Column(DateTime)
