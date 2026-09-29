// Autor: Ivana Mušikić 2023/0204
//
// SSU3 — Sistem prijatelja.
// Ekran prikazuje pretragu korisnika, zahteve i listu prijatelja preko mobilnog backend-a.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  acceptMobileFriendRequest,
  declineMobileFriendRequest,
  getMobileFriendsSummary,
  removeMobileFriend,
  searchMobileFriends,
  sendMobileFriendRequest,
} from '../api/mobileFriends';
import type { MobileFriendsSummary, MobileFriendUser } from '../api/mobileFriends';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useToast } from '../context/ToastContext';

type FriendTab = 'search' | 'requests' | 'friends';

const EMPTY_SUMMARY: MobileFriendsSummary = {
  friends: [],
  requests: [],
  sentRequests: [],
  searchResults: [],
};

/**
 * FriendsScreen prikazuje ekran za upravljanje prijateljima.
 * @returns JSX ekran za pretragu, zahteve i listu prijatelja.
 */
export default function FriendsScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session, isAuthenticated, isCheckingSession } = useMobileAuth();

  const [activeTab, setActiveTab] = useState<FriendTab>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState<MobileFriendsSummary>(EMPTY_SUMMARY);
  const [searchResults, setSearchResults] = useState<MobileFriendUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const token = session?.token;

  const loadSummary = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setSummary(EMPTY_SUMMARY);
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const nextSummary = await getMobileFriendsSummary(token);
      setSummary(nextSummary);
      setSearchResults(nextSummary.searchResults);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nije moguće učitati prijatelje.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      return undefined;
    }

    let cancelled = false;
    const searchTimeout = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await searchMobileFriends(token, searchTerm);

        if (!cancelled) {
          setSearchResults(response.results);
        }
      } catch (error) {
        if (!cancelled) {
          showToast('error', error instanceof Error ? error.message : 'Pretraga nije uspela.');
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(searchTimeout);
    };
  }, [isAuthenticated, searchTerm, showToast, token]);

  async function runFriendAction(id: string, action: () => Promise<{ summary: MobileFriendsSummary }>, successMessage: string) {
    setActionId(id);

    try {
      const response = await action();
      setSummary(response.summary);
      setSearchResults(response.summary.searchResults);
      showToast('success', successMessage);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Akcija nije uspela.');
    } finally {
      setActionId(null);
    }
  }

  function handleSendRequest(user: MobileFriendUser) {
    if (!token) return;
    runFriendAction(user.id, () => sendMobileFriendRequest(token, user.id), `Zahtev je poslat korisniku ${user.name}`);
  }

  function handleAcceptRequest(user: MobileFriendUser) {
    if (!token || !user.requestId) return;
    runFriendAction(user.requestId, () => acceptMobileFriendRequest(token, user.requestId as string), `${user.name} je dodat u prijatelje`);
  }

  function handleDeclineRequest(user: MobileFriendUser) {
    if (!token || !user.requestId) return;
    runFriendAction(user.requestId, () => declineMobileFriendRequest(token, user.requestId as string), 'Zahtev je odbijen');
  }

  function handleRemoveFriend(user: MobileFriendUser) {
    if (!token) return;
    runFriendAction(user.id, () => removeMobileFriend(token, user.id), `${user.name} je uklonjen iz prijatelja`);
  }

  if (isCheckingSession) {
    return (
      <div className="screen ssu-friends-screen ssu-screen">
        <section className="glass-card ssu-guest-profile-card">
          <div className="ssu-profile-avatar">…</div>
          <div className="ssu-guest-profile-content">
            <p className="eyebrow">Prijatelji</p>
            <h1>Proveravam sesiju</h1>
          </div>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="screen ssu-friends-screen ssu-screen">
        <section className="glass-card ssu-guest-profile-card">
          <div className="ssu-profile-avatar">F</div>

          <div className="ssu-guest-profile-content">
            <p className="eyebrow">Prijatelji</p>
            <h1>Prijavite se za pristup prijateljima</h1>
            <p>
              Sistem prijatelja je dostupan samo registrovanim korisnicima.
              Prijavite se ili napravite nalog.
            </p>
          </div>
        </section>

        <section className="glass-card ssu-card">
          <button className="primary-action-button ssu-main-action" onClick={() => navigate('/login')}>
            <span>Prijavi se</span>
            <span>→</span>
          </button>

          <button className="ssu-link-button" onClick={() => navigate('/register')}>
            Nemate nalog? Registrujte se
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="screen ssu-friends-screen ssu-screen">
      <section className="ssu-auth-head ssu-compact-head">
        <h1>Prijatelji</h1>
        <p>
          Pretražite korisnike, pošaljite zahteve i upravljajte listom prijatelja.
        </p>
      </section>

      <section className="ssu-tabs">
        <button
          className={activeTab === 'search' ? 'ssu-tab active' : 'ssu-tab'}
          onClick={() => setActiveTab('search')}
        >
          Pretraga
        </button>

        <button
          className={activeTab === 'requests' ? 'ssu-tab active' : 'ssu-tab'}
          onClick={() => setActiveTab('requests')}
        >
          Zahtevi {summary.requests.length > 0 ? `(${summary.requests.length})` : ''}
        </button>

        <button
          className={activeTab === 'friends' ? 'ssu-tab active' : 'ssu-tab'}
          onClick={() => setActiveTab('friends')}
        >
          Prijatelji {summary.friends.length > 0 ? `(${summary.friends.length})` : ''}
        </button>
      </section>

      {errorMessage && (
        <section className="glass-card ssu-card">
          <p className="ssu-empty-text">{errorMessage}</p>
          <button className="ssu-small-button" onClick={loadSummary}>Pokušaj ponovo</button>
        </section>
      )}

      {activeTab === 'search' && (
        <section className="glass-card ssu-card">
          <div className="ssu-section-title">
            <div>
              <p className="eyebrow">Pretraga</p>
              <h2>Pronađi korisnika</h2>
            </div>
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="friend-search">
              Ime ili korisničko ime
            </label>
            <input
              id="friend-search"
              className="ssu-input"
              type="text"
              placeholder="Na primer: Ana"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="ssu-user-list">
            {isLoading || isSearching ? (
              <p className="ssu-empty-text">Učitavanje korisnika...</p>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => (
                <article className="ssu-user-row" key={user.id}>
                  <div className="ssu-mini-avatar">{user.name[0]}</div>

                  <div className="ssu-user-info">
                    <h3>{user.name}</h3>
                    <p>@{user.username} · {user.mutualFriends} zajedničkih</p>
                  </div>

                  <button className="ssu-small-button" disabled={actionId === user.id} onClick={() => handleSendRequest(user)}>
                    {actionId === user.id ? 'Slanje...' : 'Dodaj'}
                  </button>
                </article>
              ))
            ) : (
              <p className="ssu-empty-text">Nema korisnika za unetu pretragu.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'requests' && (
        <section className="glass-card ssu-card">
          <div className="ssu-section-title">
            <div>
              <p className="eyebrow">Zahtevi</p>
              <h2>Pristigli zahtevi</h2>
            </div>
          </div>

          <div className="ssu-user-list">
            {isLoading ? (
              <p className="ssu-empty-text">Učitavanje zahteva...</p>
            ) : summary.requests.length > 0 ? (
              summary.requests.map((user) => (
                <article className="ssu-user-row stacked" key={user.requestId ?? user.id}>
                  <div className="ssu-mini-avatar">{user.name[0]}</div>

                  <div className="ssu-user-info">
                    <h3>{user.name}</h3>
                    <p>@{user.username} · {user.mutualFriends} zajedničkih</p>
                  </div>

                  <div className="ssu-request-actions">
                    <button className="ssu-small-button" disabled={actionId === user.requestId} onClick={() => handleAcceptRequest(user)}>
                      Prihvati
                    </button>

                    <button className="ssu-secondary-mini-button" disabled={actionId === user.requestId} onClick={() => handleDeclineRequest(user)}>
                      Odbij
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="ssu-empty-text">Nemate novih zahteva.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'friends' && (
        <section className="glass-card ssu-card">
          <div className="ssu-section-title">
            <div>
              <p className="eyebrow">Lista</p>
              <h2>Moji prijatelji</h2>
            </div>
          </div>

          <div className="ssu-user-list">
            {isLoading ? (
              <p className="ssu-empty-text">Učitavanje prijatelja...</p>
            ) : summary.friends.length > 0 ? (
              summary.friends.map((user) => (
                <article className="ssu-user-row" key={user.id}>
                  <div className="ssu-mini-avatar">{user.name[0]}</div>

                  <div className="ssu-user-info">
                    <h3>{user.name}</h3>
                    <p>@{user.username} · {user.mutualFriends} zajedničkih</p>
                  </div>

                  <button className="ssu-secondary-mini-button" disabled={actionId === user.id} onClick={() => handleRemoveFriend(user)}>
                    Ukloni
                  </button>
                </article>
              ))
            ) : (
              <p className="ssu-empty-text">Još uvek nemate prijatelje.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
