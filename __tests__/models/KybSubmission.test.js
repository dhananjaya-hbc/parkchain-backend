// __tests__/models/KybSubmission.test.js

jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));

const KybSubmission = require('../../src/models/KybSubmission');
const { query } = require('../../src/config/db');

describe('KybSubmission Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create()', () => {
        it('should execute INSERT query and return the new submission', async () => {
            const mockData = {
                ownerId: 'user-1',
                entityName: 'Test Business',
                address: '123 Main St',
                googleMapsLink: 'http://maps...',
                spotType: 'garage',
                documentUrl: 'http://cloudinary...'
            };

            const mockDbResponse = { id: 'kyb-1', ...mockData };
            query.mockResolvedValue({ rows: [mockDbResponse] });

            const result = await KybSubmission.create(mockData);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO kyb_submissions'),
                [
                    mockData.ownerId,
                    mockData.entityName,
                    mockData.address,
                    mockData.googleMapsLink,
                    mockData.spotType,
                    mockData.documentUrl
                ]
            );
            expect(result).toEqual(mockDbResponse);
        });
    });

    describe('findAll()', () => {
        it('should execute SELECT query and return all submissions', async () => {
            const mockRows = [
                { id: 'kyb-1', status: 'pending' },
                { id: 'kyb-2', status: 'approved' }
            ];
            query.mockResolvedValue({ rows: mockRows });

            const result = await KybSubmission.findAll();

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT')
            );
            expect(result).toEqual(mockRows);
        });
    });

    describe('findById()', () => {
        it('should execute SELECT query by ID and return the submission', async () => {
            const mockRow = { id: 'kyb-1', owner_name: 'John Doe' };
            query.mockResolvedValue({ rows: [mockRow] });

            const result = await KybSubmission.findById('kyb-1');

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE'),
                expect.arrayContaining(['kyb-1'])
            );
            expect(result).toEqual(mockRow);
        });

        it('should return null if submission is not found', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await KybSubmission.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByOwnerId()', () => {
        it('should execute SELECT query by owner ID and return submissions', async () => {
            const mockRows = [{ id: 'kyb-1', owner_id: 'user-1' }];
            query.mockResolvedValue({ rows: mockRows });

            const result = await KybSubmission.findByOwnerId('user-1');

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('owner_id = $1'),
                ['user-1']
            );
            expect(result).toEqual(mockRows);
        });
    });

    describe('updateStatus()', () => {
        it('should execute UPDATE query and return the updated submission', async () => {
            const mockUpdatedRow = { id: 'kyb-1', status: 'approved', admin_notes: 'Looks good' };
            query.mockResolvedValue({ rows: [mockUpdatedRow] });

            const result = await KybSubmission.updateStatus('kyb-1', 'approved', 'Looks good');

            expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE kyb_submissions'), ['approved', 'Looks good', 'kyb-1']);
            expect(result).toEqual(mockUpdatedRow);
        });
    });
});