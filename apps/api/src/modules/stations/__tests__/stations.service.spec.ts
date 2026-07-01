import { ConflictException, NotFoundException } from '@nestjs/common';

import { StationType } from '../stations.constants';
import { StationsService } from '../stations.service';
import { Station } from '../entities/station.entity';

describe('StationsService', () => {
  const groupementId = 'groupement-1';

  const mockStationRepository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn(() => mockStationRepository),
    query: jest.fn().mockResolvedValue(undefined),
  };

  const mockDataSource = {
    transaction: jest.fn((callback: (manager: typeof mockManager) => unknown) =>
      callback(mockManager),
    ),
  };

  let service: StationsService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockManager.query.mockResolvedValue(undefined);

    mockStationRepository.create.mockImplementation((value: Partial<Station>) => ({
      ...makeStation(),
      ...value,
    }));
    mockStationRepository.find.mockResolvedValue([]);
    mockStationRepository.findOne.mockResolvedValue(null);
    mockStationRepository.save.mockImplementation((station: Station) => Promise.resolve(station));
    mockStationRepository.remove.mockImplementation((station: Station) => Promise.resolve(station));

    service = new StationsService(mockDataSource as never);
  });

  it('retourne toutes les stations du groupement', async () => {
    const stations = [
      makeStation({ name: 'Gare du Nord' }),
      makeStation({ name: 'Aéroport CDG', id: 'station-2' }),
    ];
    mockStationRepository.find.mockResolvedValue(stations);

    const result = await service.findAll(groupementId);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Gare du Nord');
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });

  it('retourne une station par son id', async () => {
    mockStationRepository.findOne.mockResolvedValue(makeStation());

    const result = await service.findOne('station-1', groupementId);

    expect(result.id).toBe('station-1');
    expect(result.name).toBe('Gare du Nord');
  });

  it('lève NotFoundException si la station est introuvable', async () => {
    mockStationRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('inexistant', groupementId)).rejects.toThrow(NotFoundException);
  });

  it('crée une station de type CIRCLE', async () => {
    mockStationRepository.findOne.mockResolvedValue(null);

    const result = await service.create(groupementId, {
      name: 'Gare du Nord',
      type: StationType.CIRCLE,
      latitude: 48.8566,
      longitude: 2.3522,
      radiusMeters: 50,
    });

    expect(result.type).toBe(StationType.CIRCLE);
    expect(result.latitude).toBe(48.8566);
    expect(result.longitude).toBe(2.3522);
    expect(result.radiusMeters).toBe(50);
    expect(result.polygonPoints).toBeNull();
  });

  it('crée une station de type POLYGON', async () => {
    mockStationRepository.findOne.mockResolvedValue(null);

    const polygonPoints = [
      { lat: 48.856, lng: 2.352 },
      { lat: 48.857, lng: 2.353 },
      { lat: 48.855, lng: 2.354 },
    ];

    const result = await service.create(groupementId, {
      name: 'Zone Aéroport',
      type: StationType.POLYGON,
      polygonPoints,
    });

    expect(result.type).toBe(StationType.POLYGON);
    expect(result.polygonPoints).toHaveLength(3);
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.radiusMeters).toBeNull();
  });

  it('lève ConflictException si le nom existe déjà dans le groupement', async () => {
    mockStationRepository.findOne.mockResolvedValue(makeStation());

    await expect(
      service.create(groupementId, {
        name: 'Gare du Nord',
        type: StationType.CIRCLE,
        latitude: 48.8566,
        longitude: 2.3522,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('modifie le nom d une station', async () => {
    mockStationRepository.findOne
      .mockResolvedValueOnce(makeStation()) // station existe
      .mockResolvedValueOnce(null); // pas de doublon de nom

    const result = await service.update('station-1', groupementId, {
      name: 'Gare de Lyon',
    });

    expect(result.name).toBe('Gare de Lyon');
  });

  it('lève NotFoundException si la station à modifier est introuvable', async () => {
    mockStationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.update('inexistant', groupementId, { name: 'Nouveau nom' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lève ConflictException si le nouveau nom est déjà pris', async () => {
    mockStationRepository.findOne
      .mockResolvedValueOnce(makeStation({ name: 'Gare du Nord' })) // station à modifier
      .mockResolvedValueOnce(makeStation({ id: 'station-2', name: 'Gare de Lyon' })); // doublon

    await expect(
      service.update('station-1', groupementId, { name: 'Gare de Lyon' }),
    ).rejects.toThrow(ConflictException);
  });

  it('supprime une station existante', async () => {
    mockStationRepository.findOne.mockResolvedValue(makeStation());

    const result = await service.remove('station-1', groupementId);

    expect(result.id).toBe('station-1');
    expect(mockStationRepository.remove).toHaveBeenCalled();
  });

  it('lève NotFoundException si la station à supprimer est introuvable', async () => {
    mockStationRepository.findOne.mockResolvedValue(null);

    await expect(service.remove('inexistant', groupementId)).rejects.toThrow(NotFoundException);
  });

  it('utilise toujours dataSource.transaction', async () => {
    mockStationRepository.find.mockResolvedValue([]);

    await service.findAll(groupementId);

    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});

function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    id: 'station-1',
    groupementId: 'groupement-1',
    name: 'Gare du Nord',
    description: null,
    address: null,
    type: StationType.CIRCLE,
    latitude: 48.8566,
    longitude: 2.3522,
    radiusMeters: 50,
    polygonPoints: null,
    isActive: true,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}
