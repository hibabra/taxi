import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { GroupementSettings } from '../entities/groupement-settings.entity';
import { Groupement } from '../entities/groupement.entity';
import { GroupementsService } from '../groupements.service';

describe('GroupementsService', () => {
  let service: GroupementsService;

  const mockGroupementRepo = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    manager: {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      transaction: jest.fn(),
    },
    save: jest.fn(),
  };

  const mockSettingsRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const validDto = {
    address: '12 rue de Sèvres',
    city: 'Sèvres',
    contactEmail: 'contact@taxikiwi.fr',
    contactPhone: '+33145345678',
    name: 'Taxi Kiwi',
    postalCode: '92310',
  };

  /**
   * Helper qui configure le mock `transaction` pour simuler
   * le comportement de TypeORM EntityManager.
   */
  function setupTransactionMock(savedGroupement: Record<string, unknown>): void {
    mockGroupementRepo.manager.transaction.mockImplementation(
      async (callback: (manager: typeof mockGroupementRepo.manager) => Promise<unknown>) => {
        mockGroupementRepo.manager.create.mockReturnValue(savedGroupement);
        mockGroupementRepo.manager.save.mockResolvedValue(savedGroupement);
        mockGroupementRepo.manager.findOne.mockResolvedValue({
          ...savedGroupement,
          settings: { dispatchPolicy: 'STATION_FIRST', ringTimeoutSeconds: 30 },
        });
        return callback(mockGroupementRepo.manager);
      },
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsRepo.create.mockImplementation((value: Partial<GroupementSettings>) => ({
      ...value,
    }));
    mockSettingsRepo.save.mockImplementation((value: GroupementSettings) => Promise.resolve(value));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupementsService,
        { provide: getRepositoryToken(Groupement), useValue: mockGroupementRepo },
        { provide: getRepositoryToken(GroupementSettings), useValue: mockSettingsRepo },
      ],
    }).compile();

    service = module.get(GroupementsService);
  });

  // ── CREATION ─────────────────────────────────────────────

  describe('create', () => {
    it('creates a groupement with default settings in a transaction', async () => {
      // findOne retourne null pour les checks d'unicité.
      mockGroupementRepo.findOne.mockResolvedValue(null);

      const savedGroupement = { ...validDto, id: 'new-uuid', isActive: true };
      setupTransactionMock(savedGroupement);

      const result = await service.create(validDto);

      expect(result).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(mockGroupementRepo.manager.transaction).toHaveBeenCalled();
    });

    it('normalizes create payload before persisting', async () => {
      mockGroupementRepo.findOne.mockResolvedValue(null);
      const savedGroupement = { ...validDto, id: 'new-uuid', isActive: true };
      setupTransactionMock(savedGroupement);

      await service.create({
        ...validDto,
        contactEmail: ' CONTACT@TaxiKiwi.FR ',
        name: ' Taxi Kiwi ',
        serviceArea: ' Sèvres, Chaville ',
      });

      expect(mockGroupementRepo.manager.create).toHaveBeenCalledWith(
        Groupement,
        expect.objectContaining({
          contactEmail: 'contact@taxikiwi.fr',
          name: 'Taxi Kiwi',
          serviceArea: 'Sèvres, Chaville',
        }),
      );
    });

    it('rejects duplicate name', async () => {
      mockGroupementRepo.findOne.mockResolvedValueOnce({ name: validDto.name });

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    });

    it('rejects duplicate code', async () => {
      mockGroupementRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ code: 'TAXI-KIWI' });

      await expect(service.create({ ...validDto, code: 'taxi-kiwi' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('keeps generated duplicate code within the database limit', async () => {
      mockGroupementRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ code: 'A'.repeat(64) })
        .mockResolvedValueOnce(null);
      const savedGroupement = { ...validDto, id: 'new-uuid', isActive: true };
      setupTransactionMock(savedGroupement);

      await service.create({ ...validDto, name: 'A'.repeat(80) });

      expect(mockGroupementRepo.manager.create).toHaveBeenCalledWith(
        Groupement,
        expect.objectContaining({
          code: `${'A'.repeat(62)}-2`,
        }),
      );
    });
  });

  // ── READ ─────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a groupement by ID', async () => {
      const mockGroupement = { id: 'uuid-1', name: 'Taxi Kiwi', settings: {} };
      mockGroupementRepo.findOne.mockResolvedValue(mockGroupement);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(mockGroupement);
    });

    it('throws NotFoundException for unknown ID', async () => {
      mockGroupementRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('unknown-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── UPDATE ────────────────────────────────────────────────

  describe('update', () => {
    it('updates groupement fields', async () => {
      const existing = { id: 'uuid-1', name: 'Old Name', settings: {} };
      // 1st findOne: find by id → returns existing
      // 2nd findOne: name uniqueness check → returns null (no conflict)
      // 3rd findOne: reload after save → returns updated
      mockGroupementRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...existing, name: 'New Name' });
      mockGroupementRepo.save.mockResolvedValue({ ...existing, name: 'New Name' });

      const result = await service.update('uuid-1', {
        contactEmail: ' CONTACT@TaxiKiwi.FR ',
        name: ' New Name ',
      });

      expect(result.name).toBe('New Name');
      expect(mockGroupementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contactEmail: 'contact@taxikiwi.fr',
          name: 'New Name',
        }),
      );
    });

    it('rejects name change to an existing name', async () => {
      const existing = { id: 'uuid-1', name: 'Old Name', settings: {} };
      mockGroupementRepo.findOne
        .mockResolvedValueOnce(existing) // findOne by id
        .mockResolvedValueOnce({ id: 'uuid-2', name: 'Taken Name' }); // name check

      await expect(service.update('uuid-1', { name: 'Taken Name' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects blank updated required text fields', async () => {
      const existing = { id: 'uuid-1', name: 'Old Name', settings: {} };
      mockGroupementRepo.findOne.mockResolvedValueOnce(existing);

      await expect(service.update('uuid-1', { name: '   ' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── SETTINGS ─────────────────────────────────────────────

  describe('updateSettings', () => {
    it('creates missing settings instead of crashing', async () => {
      const existing = { id: 'uuid-1', name: 'Taxi Kiwi', settings: undefined };
      mockGroupementRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateSettings('uuid-1', {
        ringTimeoutSeconds: 45,
      });

      expect(mockSettingsRepo.create).toHaveBeenCalledWith({ groupementId: 'uuid-1' });
      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          groupementId: 'uuid-1',
          ringTimeoutSeconds: 45,
        }),
      );
      expect(result.ringTimeoutSeconds).toBe(45);
    });
  });

  // ── DEACTIVATE ────────────────────────────────────────────

  describe('deactivate', () => {
    it('soft-deletes by setting isActive to false', async () => {
      const existing = { id: 'uuid-1', isActive: true, name: 'Taxi Kiwi', settings: {} };
      mockGroupementRepo.findOne.mockResolvedValue(existing);
      mockGroupementRepo.save.mockResolvedValue({ ...existing, isActive: false });

      const result = await service.deactivate('uuid-1');

      expect(result.isActive).toBe(false);
    });

    it('rejects deactivation of already inactive groupement', async () => {
      const existing = { id: 'uuid-1', isActive: false, name: 'Taxi Kiwi', settings: {} };
      mockGroupementRepo.findOne.mockResolvedValue(existing);

      await expect(service.deactivate('uuid-1')).rejects.toThrow(ConflictException);
    });
  });

  // ── HARD DELETE ───────────────────────────────────────────

  describe('remove', () => {
    it('deletes a groupement permanently when no business data blocks it', async () => {
      const existing = { id: 'uuid-1', isActive: false, name: 'Taxi Kiwi', settings: {} };
      mockGroupementRepo.findOne.mockResolvedValue(existing);
      mockGroupementRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('uuid-1');

      expect(result).toEqual(existing);
      expect(mockGroupementRepo.delete).toHaveBeenCalledWith('uuid-1');
    });

    it('rejects hard delete when related business data exists', async () => {
      const existing = { id: 'uuid-1', isActive: true, name: 'Taxi Kiwi', settings: {} };
      mockGroupementRepo.findOne.mockResolvedValue(existing);
      mockGroupementRepo.delete.mockRejectedValue({
        driverError: { code: '23503' },
      });

      await expect(service.remove('uuid-1')).rejects.toThrow(ConflictException);
    });
  });
});
