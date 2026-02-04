import { describe, it, expect } from 'vitest';
import { calculateArchetype, calculateMatchStrength, getDominantCategories, ARCHETYPES } from '../archetypes';

describe('archetypes', () => {
  describe('calculateArchetype', () => {
    it('should identify Fiscal archetype correctly', () => {
      const userScores = {
        'baixo-custo': 3,
        'oposicao-governo': 3,
        'oposicao-rigoroso': 2,
        'assiduo': 2
      };

      const result = calculateArchetype(userScores);
      
      expect(result.id).toBe('fiscal');
      expect(result.name).toBe('O Fiscal');
    });

    it('should identify Progressista archetype correctly', () => {
      const userScores = {
        'progressista-costumes': 3,
        'ambientalista': 3,
        'garantista': 2,
        'estatista': 2
      };

      const result = calculateArchetype(userScores);
      
      expect(result.id).toBe('progressista');
      expect(result.name).toBe('O Progressista');
    });

    it('should identify Liberal archetype correctly', () => {
      const userScores = {
        'liberal': 3,
        'liberdade-digital': 3,
        'reformista-economico': 2,
        'baixo-custo': 1
      };

      const result = calculateArchetype(userScores);
      
      expect(result.id).toBe('liberal');
      expect(result.name).toBe('O Liberal');
    });

    it('should identify Conservador archetype correctly', () => {
      const userScores = {
        'conservador-costumes': 3,
        'rigoroso': 3,
        'ruralista': 2,
        'oposicao-governo': 1
      };

      const result = calculateArchetype(userScores);
      
      expect(result.id).toBe('conservador');
      expect(result.name).toBe('O Conservador');
    });

    it('should return an archetype when no scores match (returns first with score=0)', () => {
      const userScores = {};

      const result = calculateArchetype(userScores);
      
      // When no tags match, all have score 0, so returns the first one evaluated
      expect(ARCHETYPES.map(a => a.id)).toContain(result.id);
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('emoji');
    });

    it('should handle tied scores correctly', () => {
      // When tied, should return the first one found (based on iteration order)
      const userScores = {
        'baixo-custo': 2,
        'liberal': 2
      };

      const result = calculateArchetype(userScores);
      
      expect(ARCHETYPES.map(a => a.id)).toContain(result.id);
    });
  });

  describe('calculateMatchStrength', () => {
    it('should return "strong" for percentage >= 75', () => {
      expect(calculateMatchStrength(75)).toBe('strong');
      expect(calculateMatchStrength(80)).toBe('strong');
      expect(calculateMatchStrength(100)).toBe('strong');
    });

    it('should return "moderate" for percentage >= 50 and < 75', () => {
      expect(calculateMatchStrength(50)).toBe('moderate');
      expect(calculateMatchStrength(60)).toBe('moderate');
      expect(calculateMatchStrength(74)).toBe('moderate');
    });

    it('should return "weak" for percentage < 50', () => {
      expect(calculateMatchStrength(0)).toBe('weak');
      expect(calculateMatchStrength(25)).toBe('weak');
      expect(calculateMatchStrength(49)).toBe('weak');
    });
  });

  describe('getDominantCategories', () => {
    it('should return top 3 categories with highest politician scores', () => {
      const categoryScores = [
        { subject: 'Economia', user: 100, politician: 80 },
        { subject: 'Costumes', user: 100, politician: 60 },
        { subject: 'Meio Ambiente', user: 100, politician: 90 },
        { subject: 'Tecnologia', user: 100, politician: 40 },
        { subject: 'Segurança', user: 100, politician: 70 }
      ];

      const result = getDominantCategories(categoryScores);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('Meio Ambiente');
      expect(result[1]).toBe('Economia');
      expect(result[2]).toBe('Segurança');
    });

    it('should filter out categories with 0 politician score', () => {
      const categoryScores = [
        { subject: 'Economia', user: 100, politician: 80 },
        { subject: 'Costumes', user: 100, politician: 0 },
        { subject: 'Meio Ambiente', user: 100, politician: 60 }
      ];

      const result = getDominantCategories(categoryScores);
      
      expect(result).toHaveLength(2);
      expect(result).not.toContain('Costumes');
    });

    it('should handle less than 3 categories', () => {
      const categoryScores = [
        { subject: 'Economia', user: 100, politician: 80 }
      ];

      const result = getDominantCategories(categoryScores);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Economia');
    });

    it('should return empty array when all politician scores are 0', () => {
      const categoryScores = [
        { subject: 'Economia', user: 100, politician: 0 },
        { subject: 'Costumes', user: 100, politician: 0 }
      ];

      const result = getDominantCategories(categoryScores);
      
      expect(result).toHaveLength(0);
    });
  });
});
