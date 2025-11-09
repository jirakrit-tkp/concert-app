export type AppUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

export type Concert = {
  id: number;
  name: string;
  description: string;
  total_seats: number;
  available_seats: number;
};

export type Reservation = {
  id: number;
  status: 'reserved' | 'cancelled';
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  concert: Concert;
};

