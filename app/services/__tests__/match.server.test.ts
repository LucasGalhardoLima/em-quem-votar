import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchService } from '../match.server';
import { mockPoliticians } from '~/test/mocks/politicians';
import { db } from '~/utils/db.server';

vi.mock('~/utils/db.server');

describe('MatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculate', () => {
    beforeEach(() => {
      // Mock the database response
      (db.politician.findMany as any) = vi.fn().mockResolvedValue(mockPoliticians);
    });

    it('should calculate match percentages correctly', async () => {
      const userScores = {
        'liberal': 3,
        'baixo-custo': 2,
        'assiduo': 2,
        'liberdade-digital': 1
      };

      const result = await MatchService.calculate(userScores);

      expect(result.topPoliticians).toBeDefined();
      expect(result.topPoliticians.length).toBeGreaterThan(0);
      expect(result.topPoliticians.length).toBeLessThanOrEqual(6);

      // Check that all politicians have valid match data
      result.topPoliticians.forEach(match => {
        expect(match.politician).toHaveProperty('id');
        expect(match.politician).toHaveProperty('name');
        expect(match.politician).toHaveProperty('party');
        expect(match.percentage).toBeGreaterThanOrEqual(0);
        expect(match.percentage).toBeLessThanOrEqual(100);
        expect(Array.isArray(match.matchedTags)).toBe(true);
        expect(Array.isArray(match.categoryScores)).toBe(true);
      });
    });

    it('should return top 6 politicians sorted by match percentage', async () => {
      const userScores = {
        'liberal': 3,
        'baixo-custo': 2
      };

      const result = await MatchService.calculate(userScores);

      expect(result.topPoliticians.length).toBeLessThanOrEqual(6);
      
      // Verify they are sorted in descending order
      for (let i = 0; i < result.topPoliticians.length - 1; i++) {
        expect(result.topPoliticians[i].percentage)
          .toBeGreaterThanOrEqual(result.topPoliticians[i + 1].percentage);
      }
    });

    it('should match politicians with Pedro Oliveira (id: 3) when user has liberal tags', async () => {
      const userScores = {
        'liberal': 3,
        'liberdade-digital': 2,
        'baixo-custo': 2,
        'assiduo': 1
      };

      const result = await MatchService.calculate(userScores);

      // Pedro should have high match
      const pedroMatch = result.topPoliticians.find(m => m.politician.id === '3');
      expect(pedroMatch).toBeDefined();
      expect(pedroMatch!.percentage).toBeGreaterThan(50);
    });

    it('should calculate party averages correctly', async () => {
      const userScores = {
        'progressista-costumes': 3,
        'estatista': 2
      };

      const result = await MatchService.calculate(userScores);

      expect(result.topParties).toBeDefined();
      expect(result.topParties.length).toBeGreaterThan(0);
      expect(result.topParties.length).toBeLessThanOrEqual(5);

      // Verify party data structure
      result.topParties.forEach(party => {
        expect(party).toHaveProperty('party');
        expect(party).toHaveProperty('percentage');
        expect(party).toHaveProperty('count');
        expect(party.percentage).toBeGreaterThanOrEqual(0);
        expect(party.percentage).toBeLessThanOrEqual(100);
        expect(party.count).toBeGreaterThan(0);
      });
    });

    it('should return top 5 parties sorted by average match', async () => {
      const userScores = {
        'liberal': 2,
        'baixo-custo': 1
      };

      const result = await MatchService.calculate(userScores);

      expect(result.topParties.length).toBeLessThanOrEqual(5);
      
      // Verify they are sorted in descending order
      for (let i = 0; i < result.topParties.length - 1; i++) {
        expect(result.topParties[i].percentage)
          .toBeGreaterThanOrEqual(result.topParties[i + 1].percentage);
      }
    });

    it('should include matched tags with correct information', async () => {
      const userScores = {
        'liberal': 3,
        'baixo-custo': 2
      };

      const result = await MatchService.calculate(userScores);

      const matchWithTags = result.topPoliticians.find(m => m.matchedTags.length > 0);
      expect(matchWithTags).toBeDefined();

      if (matchWithTags) {
        matchWithTags.matchedTags.forEach(tag => {
          expect(tag).toHaveProperty('slug');
          expect(tag).toHaveProperty('name');
          expect(tag).toHaveProperty('score');
          expect(tag).toHaveProperty('reasonText');
          expect(tag.score).toBeGreaterThan(0);
        });
      }
    });

    it('should sort matched tags by score', async () => {
      const userScores = {
        'liberal': 3,
        'baixo-custo': 2,
        'liberdade-digital': 1
      };

      const result = await MatchService.calculate(userScores);

      result.topPoliticians.forEach(match => {
        if (match.matchedTags.length > 1) {
          for (let i = 0; i < match.matchedTags.length - 1; i++) {
            expect(match.matchedTags[i].score)
              .toBeGreaterThanOrEqual(match.matchedTags[i + 1].score);
          }
        }
      });
    });

    it('should calculate category scores correctly', async () => {
      const userScores = {
        'liberal': 3,
        'estatista': 2
      };

      const result = await MatchService.calculate(userScores);

      result.topPoliticians.forEach(match => {
        expect(match.categoryScores.length).toBeGreaterThan(0);
        
        match.categoryScores.forEach(category => {
          expect(category).toHaveProperty('subject');
          expect(category).toHaveProperty('user');
          expect(category).toHaveProperty('politician');
          expect(category).toHaveProperty('fullMark');
          expect(category.user).toBe(100);
          expect(category.fullMark).toBe(100);
          expect(category.politician).toBeGreaterThanOrEqual(0);
          expect(category.politician).toBeLessThanOrEqual(100);
        });
      });
    });

    it('should return metadata with archetype, match strength and dominant categories', async () => {
      const userScores = {
        'liberal': 3,
        'liberdade-digital': 2,
        'reformista-economico': 1
      };

      const result = await MatchService.calculate(userScores);

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('archetype');
      expect(result.metadata).toHaveProperty('matchStrength');
      expect(result.metadata).toHaveProperty('dominantCategories');

      expect(result.metadata.archetype).toHaveProperty('id');
      expect(result.metadata.archetype).toHaveProperty('name');
      expect(['strong', 'moderate', 'weak']).toContain(result.metadata.matchStrength);
      expect(Array.isArray(result.metadata.dominantCategories)).toBe(true);
    });

    it('should handle empty user scores', async () => {
      const userScores = {};

      const result = await MatchService.calculate(userScores);

      expect(result.topPoliticians).toBeDefined();
      expect(result.topParties).toBeDefined();
      expect(result.metadata).toBeDefined();
      
      // All politicians should have 0% match
      result.topPoliticians.forEach(match => {
        expect(match.percentage).toBe(0);
      });
    });

    it('should handle user scores with no matching tags', async () => {
      const userScores = {
        'non-existent-tag': 5,
        'another-fake-tag': 3
      };

      const result = await MatchService.calculate(userScores);

      expect(result.topPoliticians).toBeDefined();
      
      // All politicians should have 0% match
      result.topPoliticians.forEach(match => {
        expect(match.percentage).toBe(0);
        expect(match.matchedTags.length).toBe(0);
      });
    });

    it('should return user scores in the result', async () => {
      const userScores = {
        'liberal': 3,
        'baixo-custo': 2
      };

      const result = await MatchService.calculate(userScores);

      expect(result.userScores).toEqual(userScores);
    });

    it('should handle negative weights (should not happen, but testing robustness)', async () => {
      const userScores = {
        'liberal': -3,
        'baixo-custo': 2
      };

      const result = await MatchService.calculate(userScores);

      // Should still return valid results
      expect(result.topPoliticians).toBeDefined();
      expect(result.topPoliticians.length).toBeGreaterThan(0);
    });
  });
});
