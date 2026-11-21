import type { Taggable } from './types';

/** Films connus à swiper au premier lancement, pour démarrer le profil. */
export interface Seed extends Taggable {
  id: string;
  title: string;
}

export const SEEDS: Seed[] = [
  { id: 'intouchables', title: 'Intouchables', year: '2011', genres: ['Comédie', 'Drame'], directors: ['Olivier Nakache', 'Éric Toledano'], cast: ['Omar Sy', 'François Cluzet'] },
  { id: 'inception', title: 'Inception', year: '2010', genres: ['Science-fiction', 'Action'], directors: ['Christopher Nolan'], cast: ['Leonardo DiCaprio', 'Marion Cotillard'] },
  { id: 'diner-cons', title: 'Le Dîner de cons', year: '1998', genres: ['Comédie'], directors: ['Francis Veber'], cast: ['Thierry Lhermitte', 'Jacques Villeret'] },
  { id: 'alien', title: 'Alien', year: '1979', genres: ['Horreur', 'Science-fiction'], directors: ['Ridley Scott'], cast: ['Sigourney Weaver'] },
  { id: 'amelie', title: 'Le Fabuleux Destin d\'Amélie Poulain', year: '2001', genres: ['Comédie', 'Romance'], directors: ['Jean-Pierre Jeunet'], cast: ['Audrey Tautou', 'Mathieu Kassovitz'] },
  { id: 'parrain', title: 'Le Parrain', year: '1972', genres: ['Policier', 'Drame'], directors: ['Francis Ford Coppola'], cast: ['Marlon Brando', 'Al Pacino'] },
  { id: 'toy-story', title: 'Toy Story', year: '1995', genres: ['Animation', 'Famille'], directors: ['John Lasseter'], cast: [] },
  { id: 'get-out', title: 'Get Out', year: '2017', genres: ['Horreur', 'Thriller'], directors: ['Jordan Peele'], cast: ['Daniel Kaluuya'] },
  { id: 'lalaland', title: 'La La Land', year: '2016', genres: ['Romance', 'Musical'], directors: ['Damien Chazelle'], cast: ['Ryan Gosling', 'Emma Stone'] },
  { id: 'seigneur', title: 'Le Seigneur des anneaux', year: '2001', genres: ['Fantastique', 'Aventure'], directors: ['Peter Jackson'], cast: ['Elijah Wood', 'Viggo Mortensen'] },
  { id: 'silence', title: 'Le Silence des agneaux', year: '1991', genres: ['Thriller', 'Policier'], directors: ['Jonathan Demme'], cast: ['Jodie Foster', 'Anthony Hopkins'] },
  { id: 'visiteurs', title: 'Les Visiteurs', year: '1993', genres: ['Comédie', 'Fantastique'], directors: ['Jean-Marie Poiré'], cast: ['Jean Reno', 'Christian Clavier'] },
];
