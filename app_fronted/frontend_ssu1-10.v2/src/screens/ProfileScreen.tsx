// Autor: Ivana Mušikić 2023/0204
//
// SSU2 — Pregled i izmena profila korisnika.
// Komponenta prikazuje profil registrovanog korisnika ili gostu nudi prijavu/registraciju.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useTableSession } from '../context/TableSessionContext';
import StandardBottomSheet from '../components/ui/StandardBottomSheet';
import { getMobileProfile, updateMobileProfile } from '../api/mobileProfile';
import type { MobileProfileResponse } from '../api/mobileProfile';
import {
  acceptMobileFriendRequest,
  declineMobileFriendRequest,
  removeMobileFriend,
  searchMobileFriends,
  sendMobileFriendRequest,
} from '../api/mobileFriends';
import type { MobileFriendUser, MobileFriendsSummary } from '../api/mobileFriends';

type ProfileSheetMode = 'friends' | 'addFriend' | null;

const EMPTY_FRIENDS_SUMMARY: MobileFriendsSummary = {
  friends: [],
  requests: [],
  sentRequests: [],
  searchResults: [],
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Došlo je do greške.';
}

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'G';
}

/**
 * ProfileScreen prikazuje profil prijavljenog korisnika.
 * Ako korisnik nije prijavljen, prikazuje početni ekran za gosta.
 * @returns JSX ekran profila korisnika ili gostujući ekran.
 */
export default function ProfileScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session, user, isAnonymous, isAuthenticated, isCheckingSession, continueAsGuest, logout, updateSessionUser } = useMobileAuth();
  const { hasActiveTableSession } = useTableSession();

  const isLoggedIn = isAuthenticated;
  const isAnonymousGuest = Boolean(session?.token && isAnonymous && !isAuthenticated);
  const guestReturnLabel = hasActiveTableSession ? 'Vrati se na meni' : 'Skeniraj QR kod';
  const guestReturnPath = hasActiveTableSession ? '/menu' : '/scan';
  const token = session?.token ?? '';

  const [isEditing, setIsEditing] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profile, setProfile] = useState<MobileProfileResponse | null>(null);
  const [fullName, setFullName] = useState(localStorage.getItem('userName') || '');
  const [username, setUsername] = useState(localStorage.getItem('userUsername') || '');
  const [email, setEmail] = useState(localStorage.getItem('userEmail') || '');

  const [profileSheetMode, setProfileSheetMode] = useState<ProfileSheetMode>(null);
  const [friendSearchTerm, setFriendSearchTerm] = useState('');
  const [friendsSummary, setFriendsSummary] = useState<MobileFriendsSummary>(EMPTY_FRIENDS_SUMMARY);
  const [searchResults, setSearchResults] = useState<MobileFriendUser[]>([]);
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);

  const friends = friendsSummary.friends;
  const friendRequests = friendsSummary.requests;
  const sentRequests = friendsSummary.sentRequests;
  const suggestedUsers = friendsSummary.searchResults;
  const usersForAdding = friendSearchTerm.trim() ? searchResults : suggestedUsers;
  const rewardPoints = profile?.stats.rewardPoints ?? Number(localStorage.getItem('rewardPoints') || 0);
  const friendsCount = profile?.stats.friendsCount ?? friends.length;

  useEffect(() => {
    if (!user || !isAuthenticated) {
      return;
    }

    const nextFullName = user.fullName || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Korisnik';

    setFullName(nextFullName);
    setUsername(user.username || 'korisnik');
    setEmail(user.email || '');
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setProfile(null);
      setFriendsSummary(EMPTY_FRIENDS_SUMMARY);
      return undefined;
    }

    let cancelled = false;

    async function loadProfile() {
      setIsProfileLoading(true);

      try {
        const response = await getMobileProfile(token);

        if (cancelled) {
          return;
        }

        setProfile(response);
        setFriendsSummary(response.friendsSummary ?? EMPTY_FRIENDS_SUMMARY);
        setSearchResults(response.friendsSummary?.searchResults ?? []);
        updateSessionUser(response.user, response.isAnonymous);
        localStorage.setItem('rewardPoints', String(response.stats.rewardPoints ?? 0));
      } catch (error) {
        if (!cancelled) {
          showToast('error', getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, showToast, token, updateSessionUser]);

  useEffect(() => {
    if (profileSheetMode !== 'addFriend' || !token) {
      return undefined;
    }

    const query = friendSearchTerm.trim();

    if (!query) {
      setSearchResults(suggestedUsers);
      return undefined;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsSearchingFriends(true);

      try {
        const response = await searchMobileFriends(token, query);

        if (!cancelled) {
          setSearchResults(response.results);
        }
      } catch (error) {
        if (!cancelled) {
          showToast('error', getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsSearchingFriends(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [friendSearchTerm, profileSheetMode, showToast, suggestedUsers, token]);

  async function refreshProfile() {
    if (!token) {
      return;
    }

    const response = await getMobileProfile(token);
    setProfile(response);
    setFriendsSummary(response.friendsSummary ?? EMPTY_FRIENDS_SUMMARY);
    setSearchResults(response.friendsSummary?.searchResults ?? []);
    updateSessionUser(response.user, response.isAnonymous);
    localStorage.setItem('rewardPoints', String(response.stats.rewardPoints ?? 0));
  }

  /**
   * Čuva izmenjene podatke profila u backend bazu.
   * @returns void
   */
  async function handleSaveProfile() {
    if (!fullName.trim() || !username.trim() || !email.trim()) {
      showToast('error', 'Popunite sva polja');
      return;
    }

    if (!token) {
      showToast('error', 'Sesija nije pronađena. Prijavite se ponovo.');
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await updateMobileProfile(token, { fullName, username, email });

      setProfile(response);
      setFriendsSummary(response.friendsSummary ?? EMPTY_FRIENDS_SUMMARY);
      updateSessionUser(response.user, response.isAnonymous);
      localStorage.setItem('rewardPoints', String(response.stats.rewardPoints ?? 0));
      setIsEditing(false);
      showToast('success', 'Profil je uspešno izmenjen');
    } catch (error) {
      showToast('error', getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  /**
   * Odjavljuje korisnika i prebacuje ga u gostujući režim.
   * @returns void
   */
  async function handleLogout() {
    await logout();
    setIsEditing(false);
    setProfile(null);
    setFriendsSummary(EMPTY_FRIENDS_SUMMARY);
    showToast('info', 'Odjavili ste se');

    setTimeout(() => {
      navigate('/profile');
    }, 500);
  }

  async function handleContinueAsGuest() {
    if (isAnonymousGuest) {
      navigate(guestReturnPath);
      return;
    }

    setIsGuestSubmitting(true);

    try {
      await continueAsGuest();
      showToast('info', 'Nastavljate kao gost');

      setTimeout(() => {
        navigate('/scan');
      }, 500);
    } catch (error) {
      showToast('error', getErrorMessage(error));
    } finally {
      setIsGuestSubmitting(false);
    }
  }

  async function runFriendAction(actionKey: string, action: () => Promise<{ ok: boolean; summary?: MobileFriendsSummary }>, message: string) {
    if (!token) {
      showToast('error', 'Sesija nije pronađena. Prijavite se ponovo.');
      return;
    }

    setFriendActionId(actionKey);

    try {
      const response = await action();

      if (response.summary) {
        setFriendsSummary(response.summary);
        setSearchResults(response.summary.searchResults ?? []);
      } else {
        await refreshProfile();
      }

      showToast('success', message);
    } catch (error) {
      showToast('error', getErrorMessage(error));
    } finally {
      setFriendActionId(null);
    }
  }

  function handleRemoveFriend(friend: MobileFriendUser) {
    runFriendAction(`remove-${friend.id}`, () => removeMobileFriend(token, friend.id), `${friend.name} je uklonjen iz prijatelja`);
  }

  function handleSendFriendRequest(friend: MobileFriendUser) {
    runFriendAction(`send-${friend.id}`, () => sendMobileFriendRequest(token, friend.id), `Zahtev je poslat korisniku ${friend.name}`);
  }

  function handleAcceptFriendRequest(friend: MobileFriendUser) {
    const requestId = friend.requestId;

    if (!requestId) {
      showToast('error', 'Zahtev nije pronađen.');
      return;
    }

    runFriendAction(`accept-${requestId}`, () => acceptMobileFriendRequest(token, requestId), `${friend.name} je dodat u prijatelje`);
  }

  function handleDeclineFriendRequest(friend: MobileFriendUser) {
    const requestId = friend.requestId;

    if (!requestId) {
      showToast('error', 'Zahtev nije pronađen.');
      return;
    }

    runFriendAction(`decline-${requestId}`, () => declineMobileFriendRequest(token, requestId), 'Zahtev je odbijen');
  }

  const profileInitials = useMemo(() => getInitials(fullName || user?.fullName || 'Gost'), [fullName, user?.fullName]);

  if (isCheckingSession) {
    return (
      <div className="screen ssu-profile-screen ssu-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">…</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">OpenTab</p>
            <h1>Proveravam sesiju</h1>
            <p>Sačekajte trenutak dok proverimo da li ste već prijavljeni.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="screen ssu-profile-screen ssu-screen ssu-entry-profile-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card ssu-entry-access-card">
          <div className="ssu-centered-icon">OT</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">{isAnonymousGuest ? 'Gostujući pristup' : 'Dobro došli u OpenTab'}</p>
            <h1>{isAnonymousGuest ? 'Koristite aplikaciju kao gost' : 'Birajte način prijave'}</h1>
            <p>
              {isAnonymousGuest
                ? 'Već ste povezani kao gost. Možete se prijaviti ili registrovati, a postojeći sto ostaje aktivan dok se ne vratite u meni ili završite sesiju.'
                : 'Prijavite se postojećim nalogom, napravite novi profil ili nastavite kao gost za brzo skeniranje QR koda i pregled menija.'}
            </p>
          </div>

          <div className="ssu-centered-actions">
            <button className="primary-action-button ssu-main-action" onClick={() => navigate('/login')}>
              <span>Prijavi se</span>
              <span>→</span>
            </button>

            <button className="ssu-entry-action-button" onClick={() => navigate('/register')}>
              <span>Registruj se</span>
              <span>→</span>
            </button>

            <button className="ssu-entry-action-button muted" onClick={handleContinueAsGuest} disabled={isGuestSubmitting}>
              <span>{isAnonymousGuest ? guestReturnLabel : isGuestSubmitting ? 'Pokretanje gosta...' : 'Nastavi kao gost'}</span>
              <span>→</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="screen ssu-profile-screen ssu-screen ssu-edit-profile-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card ssu-auth-centered-card ssu-edit-profile-card">
          <div className="ssu-centered-icon ssu-edit-profile-icon">{profileInitials}</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Podešavanja profila</p>
            <h1>Izmeni profil</h1>
            <p>Promenite osnovne informacije koje se prikazuju na vašem nalogu.</p>
          </div>

          <div className="ssu-centered-form">
            <div className="ssu-form-group">
              <label className="ssu-label" htmlFor="profile-full-name">
                Ime i prezime
              </label>
              <input
                id="profile-full-name"
                className="ssu-input"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="ssu-form-group">
              <label className="ssu-label" htmlFor="profile-username">
                Korisničko ime
              </label>
              <input
                id="profile-username"
                className="ssu-input"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="ssu-form-group">
              <label className="ssu-label" htmlFor="profile-email">
                Email adresa
              </label>
              <input
                id="profile-email"
                className="ssu-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="ssu-centered-actions ssu-edit-profile-actions">
            <button className="primary-action-button ssu-main-action" onClick={handleSaveProfile} disabled={isSavingProfile}>
              <span>{isSavingProfile ? 'Čuvanje...' : 'Sačuvaj izmene'}</span>
              <span>✓</span>
            </button>

            <button className="ssu-entry-action-button muted" onClick={() => setIsEditing(false)} disabled={isSavingProfile}>
              <span>Otkaži</span>
              <span>←</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen ssu-profile-screen ssu-screen ssu-account-profile-screen">
      <button className="ssu-profile-back-button" type="button" aria-label="Nazad u meni" onClick={() => navigate('/menu')}>
        <span>←</span>
      </button>

      <section className="glass-card ssu-account-card ssu-profile-social-card">
        <div className="ssu-profile-card-glow" aria-hidden="true" />

        <div className="ssu-profile-social-main">
          <div className="ssu-profile-avatar ssu-profile-social-avatar">{profileInitials}</div>

          <div className="ssu-profile-social-copy">
            <p className="eyebrow">Registrovani gost</p>
            <h1>{fullName || 'Korisnik'}</h1>
            <span>@{username || 'korisnik'}</span>
            {email && <small>{email}</small>}
          </div>
        </div>

        {isProfileLoading && <p className="ssu-profile-sync-note">Osvežavam podatke iz baze...</p>}

        <div className="ssu-profile-social-stats">
          <button type="button" onClick={() => setProfileSheetMode('friends')}>
            <strong>{friendsCount}</strong>
            <span>Prijatelja</span>
          </button>

          <div>
            <strong>{rewardPoints}</strong>
            <span>Poena</span>
          </div>

          <div>
            <strong>{profile?.stats.ordersCount ?? 0}</strong>
            <span>Narudžbina</span>
          </div>
        </div>

        <div className="ssu-profile-social-actions">
          <button className="primary-action-button ssu-main-action" onClick={() => setIsEditing(true)}>
            <span>Izmeni profil</span>
            <span>✎</span>
          </button>

          <button className="ssu-entry-action-button" onClick={() => setProfileSheetMode('friends')}>
            <span>Prijatelji</span>
            <span>👥</span>
          </button>

          <button className="ssu-entry-action-button muted" onClick={() => setProfileSheetMode('addFriend')}>
            <span>Dodaj prijatelja</span>
            <span>＋</span>
          </button>
        </div>
      </section>

      <section className="ssu-profile-activity-grid" aria-label="Aktivnost korisnika">
        <article className="glass-card ssu-profile-activity-card">
          <span>📅</span>
          <div>
            <strong>{profile?.stats.reservationsCount ?? 0}</strong>
            <p>Rezervacije</p>
          </div>
        </article>

        <article className="glass-card ssu-profile-activity-card">
          <span>💳</span>
          <div>
            <strong>{Math.round(profile?.stats.paidAmount ?? 0).toLocaleString('sr-RS')}</strong>
            <p>Potrošeno RSD</p>
          </div>
        </article>
      </section>

      <button className="ssu-danger-button ssu-profile-logout-button" onClick={handleLogout}>
        <span>Odjavi se</span>
        <span>↗</span>
      </button>
      <StandardBottomSheet
        open={profileSheetMode === 'friends'}
        onClose={() => setProfileSheetMode(null)}
        ariaLabel="Lista prijatelja"
        sheetClassName="ssu-profile-friends-sheet ssu-profile-sheet-friends"
      >
        <div className="ssu-sheet-content">
          <div className="ssu-sheet-title">
            <h2>Prijatelji</h2>
          </div>

          <div className="ssu-user-list">
            {friends.length > 0 ? (
              friends.map((friend) => (
                <article className="ssu-user-row" key={friend.id}>
                  <div className="ssu-mini-avatar">{getInitials(friend.name)}</div>

                  <div className="ssu-user-info">
                    <h3>{friend.name}</h3>
                    <p>
                      @{friend.username} · {friend.mutualFriends} zajedničkih
                    </p>
                  </div>

                  <button className="ssu-secondary-mini-button" onClick={() => handleRemoveFriend(friend)} disabled={friendActionId === `remove-${friend.id}`}>
                    {friendActionId === `remove-${friend.id}` ? '...' : 'Ukloni'}
                  </button>
                </article>
              ))
            ) : (
              <p className="ssu-empty-text">Još uvek nemate prijatelje.</p>
            )}
          </div>
        </div>
      </StandardBottomSheet>

      <StandardBottomSheet
        open={profileSheetMode === 'addFriend'}
        onClose={() => setProfileSheetMode(null)}
        ariaLabel="Dodavanje prijatelja"
        sheetClassName="ssu-profile-friends-sheet ssu-profile-sheet-add"
      >
        <div className="ssu-sheet-content">
          <div className="ssu-sheet-title">
            <h2>Dodaj prijatelja</h2>
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="profile-friend-search">
              Ime ili korisničko ime
            </label>
            <input
              id="profile-friend-search"
              className="ssu-input"
              type="text"
              placeholder="Na primer: Jelena"
              value={friendSearchTerm}
              onChange={(event) => setFriendSearchTerm(event.target.value)}
            />
          </div>

          <div className="ssu-sheet-subtitle-row">
            <span>{friendSearchTerm.trim() ? 'Pretraga korisnika' : 'Predlozi korisnika'}</span>
            <span>{isSearchingFriends ? '...' : usersForAdding.length}</span>
          </div>

          <div className="ssu-user-list">
            {usersForAdding.length > 0 ? (
              usersForAdding.map((friend) => (
                <article className="ssu-user-row" key={friend.id}>
                  <div className="ssu-mini-avatar">{getInitials(friend.name)}</div>

                  <div className="ssu-user-info">
                    <h3>{friend.name}</h3>
                    <p>
                      @{friend.username} · {friend.mutualFriends} zajedničkih
                    </p>
                  </div>

                  <button className="ssu-small-button" onClick={() => handleSendFriendRequest(friend)} disabled={friendActionId === `send-${friend.id}`}>
                    {friendActionId === `send-${friend.id}` ? '...' : 'Dodaj'}
                  </button>
                </article>
              ))
            ) : (
              <p className="ssu-empty-text">Nema korisnika za unetu pretragu.</p>
            )}
          </div>

          <div className="ssu-sheet-subtitle-row with-margin">
            <span>Zahtevi</span>
            <span>{friendRequests.length}</span>
          </div>

          <div className="ssu-user-list">
            {friendRequests.length > 0 ? (
              friendRequests.map((request) => (
                <article className="ssu-user-row stacked" key={request.requestId ?? request.id}>
                  <div className="ssu-mini-avatar">{getInitials(request.name)}</div>

                  <div className="ssu-user-info">
                    <h3>{request.name}</h3>
                    <p>
                      @{request.username} · {request.mutualFriends} zajedničkih
                    </p>
                  </div>

                  <div className="ssu-request-actions">
                    <button className="ssu-small-button" onClick={() => handleAcceptFriendRequest(request)} disabled={friendActionId === `accept-${request.requestId}`}>
                      {friendActionId === `accept-${request.requestId}` ? '...' : 'Prihvati'}
                    </button>

                    <button className="ssu-secondary-mini-button" onClick={() => handleDeclineFriendRequest(request)} disabled={friendActionId === `decline-${request.requestId}`}>
                      Odbij
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="ssu-empty-text">Nemate novih zahteva.</p>
            )}
          </div>

          {sentRequests.length > 0 && (
            <>
              <div className="ssu-sheet-subtitle-row with-margin">
                <span>Poslati zahtevi</span>
                <span>{sentRequests.length}</span>
              </div>

              <div className="ssu-user-list">
                {sentRequests.map((request) => (
                  <article className="ssu-user-row" key={request.requestId ?? request.id}>
                    <div className="ssu-mini-avatar">{getInitials(request.name)}</div>

                    <div className="ssu-user-info">
                      <h3>{request.name}</h3>
                      <p>@{request.username} · čeka odgovor</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </StandardBottomSheet>
    </div>
  );
}
