import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

describe('CreateReservationDto', () => {
  const buildPayload = (overrides: Partial<CreateReservationDto> = {}): CreateReservationDto => ({
    userId: 1,
    concertId: 2,
    ...overrides,
  });

  const validateDto = async (payload: Partial<CreateReservationDto>) => {
    const instance = plainToInstance(CreateReservationDto, payload);
    return validate(instance);
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(buildPayload());
    expect(errors).toHaveLength(0);
  });

  it('rejects missing userId', async () => {
    const { userId, ...payload } = buildPayload();
    const errors = await validateDto(payload);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-positive userId', async () => {
    const errors = await validateDto(buildPayload({ userId: 0 }));
    expect(errors).not.toHaveLength(0);
  });

  it('rejects missing concertId', async () => {
    const { concertId, ...payload } = buildPayload();
    const errors = await validateDto(payload);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-positive concertId', async () => {
    const errors = await validateDto(buildPayload({ concertId: -3 }));
    expect(errors).not.toHaveLength(0);
  });
});

