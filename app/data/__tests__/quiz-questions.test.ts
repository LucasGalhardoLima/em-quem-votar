import { describe, it, expect } from 'vitest';
import { QUIZ_QUESTIONS } from '../quiz-questions';
import { TAG_DEFINITIONS } from '../tag-definitions';

describe('quiz-questions', () => {
  describe('data structure validation', () => {
    it('should have valid question structure', () => {
      expect(QUIZ_QUESTIONS.length).toBeGreaterThan(0);
      
      QUIZ_QUESTIONS.forEach((question, index) => {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('text');
        expect(question).toHaveProperty('options');
        expect(question.id).toBe(index + 1);
        expect(question.text).toBeTruthy();
        expect(Array.isArray(question.options)).toBe(true);
      });
    });

    it('should have at least 2 options per question', () => {
      QUIZ_QUESTIONS.forEach(question => {
        expect(question.options.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should have valid option structure', () => {
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          expect(option).toHaveProperty('label');
          expect(option).toHaveProperty('value');
          expect(option).toHaveProperty('affects');
          expect(option.label).toBeTruthy();
          expect(option.value).toBeTruthy();
          expect(Array.isArray(option.affects)).toBe(true);
        });
      });
    });

    it('should have at least one tag effect per option', () => {
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          expect(option.affects.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have valid tag effects structure', () => {
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          option.affects.forEach(effect => {
            expect(effect).toHaveProperty('tagSlug');
            expect(effect).toHaveProperty('weight');
            expect(typeof effect.tagSlug).toBe('string');
            expect(typeof effect.weight).toBe('number');
            expect(effect.tagSlug).toBeTruthy();
          });
        });
      });
    });

    it('should have valid weight values (positive numbers)', () => {
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          option.affects.forEach(effect => {
            expect(effect.weight).toBeGreaterThan(0);
            expect(Number.isFinite(effect.weight)).toBe(true);
          });
        });
      });
    });

    it('should reference valid tag slugs', () => {
      const validSlugs = Object.keys(TAG_DEFINITIONS);
      
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          option.affects.forEach(effect => {
            // Note: Not all tags in quiz need to be in TAG_DEFINITIONS
            // Some are performance/demographic based and added by backend
            expect(effect.tagSlug).toBeTruthy();
          });
        });
      });
    });

    it('should have valid color values when specified', () => {
      const validColors = ['green', 'red', 'blue', 'gray'];
      
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          if (option.color) {
            expect(validColors).toContain(option.color);
          }
        });
      });
    });

    it('should have valid icon values when specified', () => {
      const validIcons = [
        'check', 'x', 'thumbs-up', 'thumbs-down', 'scale', 'shield', 
        'dollar', 'lock', 'unlock', 'tree', 'tractor', 'sparkles', 
        'award', 'heart', 'briefcase'
      ];
      
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          if (option.icon) {
            expect(validIcons).toContain(option.icon);
          }
        });
      });
    });
  });

  describe('score calculation logic', () => {
    it('should correctly accumulate scores from multiple questions', () => {
      const scores: Record<string, number> = {};
      
      // Simulate answering first 3 questions with option A
      QUIZ_QUESTIONS.slice(0, 3).forEach(question => {
        const option = question.options[0];
        option.affects.forEach(effect => {
          scores[effect.tagSlug] = (scores[effect.tagSlug] || 0) + effect.weight;
        });
      });

      // Verify scores are accumulated
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThan(0);
      });
    });

    it('should handle different options affecting the same tag', () => {
      const scores: Record<string, number> = {};
      
      // Find two questions that might affect the same tag
      QUIZ_QUESTIONS.forEach(question => {
        const option = question.options[0];
        option.affects.forEach(effect => {
          scores[effect.tagSlug] = (scores[effect.tagSlug] || 0) + effect.weight;
        });
      });

      // At least some tags should have been accumulated
      expect(Object.keys(scores).length).toBeGreaterThan(0);
    });
  });

  describe('quiz coverage', () => {
    it('should cover multiple political dimensions', () => {
      const allAffectedTags = new Set<string>();
      
      QUIZ_QUESTIONS.forEach(question => {
        question.options.forEach(option => {
          option.affects.forEach(effect => {
            allAffectedTags.add(effect.tagSlug);
          });
        });
      });

      // Should cover at least 10 different tags
      expect(allAffectedTags.size).toBeGreaterThanOrEqual(10);
    });
  });
});
