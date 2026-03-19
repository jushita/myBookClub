import { useEffect, useMemo, useState } from "react";
import { createClubForUser, fetchAllClubs, fetchClubMembers, fetchUserClubs, joinClubForUser } from "../services/clubs";
import type { AuthUser, Club, ClubMember } from "../types";

export function useClubState(authUser: AuthUser | null) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [clubManagementMode, setClubManagementMode] = useState<"overview" | "create" | "join">("overview");
  const [clubSelectorOpen, setClubSelectorOpen] = useState(false);
  const [selectedClubMembers, setSelectedClubMembers] = useState<ClubMember[]>([]);
  const [currentClubBook, setCurrentClubBook] = useState("");
  const [clubSearchTerm, setClubSearchTerm] = useState("");
  const [selectedJoinClubId, setSelectedJoinClubId] = useState("");
  const [selectedJoinClubMembers, setSelectedJoinClubMembers] = useState<ClubMember[]>([]);
  const [createClubName, setCreateClubName] = useState("");
  const [createClubDescription, setCreateClubDescription] = useState("");
  const [createClubVibe, setCreateClubVibe] = useState("");
  const [clubActionLoading, setClubActionLoading] = useState(false);
  const [clubActionError, setClubActionError] = useState<string | null>(null);

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId) ?? clubs[0];
  }, [clubs, selectedClubId]);

  const joinableClubs = useMemo(() => {
    const joinedIds = new Set(clubs.map((club) => club.id));
    const normalizedQuery = clubSearchTerm.trim().toLowerCase();

    return allClubs.filter((club) => {
      if (joinedIds.has(club.id)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [club.name, club.vibe, club.description || ""].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [allClubs, clubSearchTerm, clubs]);

  const selectedJoinClub = useMemo(() => {
    return joinableClubs.find((club) => club.id === selectedJoinClubId) ?? joinableClubs[0];
  }, [joinableClubs, selectedJoinClubId]);

  const refreshClubs = async (userId: string) => {
    const [nextUserClubs, nextAllClubs] = await Promise.all([fetchUserClubs(userId), fetchAllClubs()]);

    setClubs(nextUserClubs);
    setAllClubs(nextAllClubs);
    setSelectedClubId((current) =>
      current && nextUserClubs.some((club) => club.id === current) ? current : (nextUserClubs[0]?.id ?? "")
    );
  };

  useEffect(() => {
    if (!authUser) {
      setClubs([]);
      setAllClubs([]);
      setSelectedClubId("");
      setSelectedClubMembers([]);
      setCurrentClubBook("");
      setClubManagementMode("overview");
      setClubSearchTerm("");
      setSelectedJoinClubId("");
      setSelectedJoinClubMembers([]);
      setCreateClubName("");
      setCreateClubDescription("");
      setCreateClubVibe("");
      setClubActionError(null);
      return;
    }

    let ignore = false;

    const loadClubs = async () => {
      try {
        await refreshClubs(authUser.id);
        if (ignore) {
          return;
        }
      } catch (error) {
        if (!ignore) {
          setClubs([]);
          setAllClubs([]);
          setSelectedClubId("");
          setClubActionError(error instanceof Error ? error.message : "Could not load clubs.");
        }
      }
    };

    void loadClubs();

    return () => {
      ignore = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!selectedJoinClub) {
      setSelectedJoinClubMembers([]);
      return;
    }

    let ignore = false;

    const loadJoinClubMembers = async () => {
      try {
        const members = await fetchClubMembers(selectedJoinClub.id);
        if (!ignore) {
          setSelectedJoinClubMembers(members);
        }
      } catch {
        if (!ignore) {
          setSelectedJoinClubMembers([]);
        }
      }
    };

    void loadJoinClubMembers();

    return () => {
      ignore = true;
    };
  }, [selectedJoinClub]);

  useEffect(() => {
    setSelectedJoinClubId((current) =>
      current && joinableClubs.some((club) => club.id === current) ? current : (joinableClubs[0]?.id ?? "")
    );
  }, [joinableClubs]);

  useEffect(() => {
    if (!authUser || !selectedClub) {
      setSelectedClubMembers([]);
      return;
    }

    let ignore = false;

    const loadMembers = async () => {
      try {
        const members = await fetchClubMembers(selectedClub.id);
        if (!ignore) {
          setSelectedClubMembers(members.filter((member) => member.userId !== authUser.id));
        }
      } catch {
        if (!ignore) {
          setSelectedClubMembers([]);
        }
      }
    };

    void loadMembers();

    return () => {
      ignore = true;
    };
  }, [authUser, selectedClub]);

  const selectClub = (clubId: string) => {
    setSelectedClubId(clubId);
    setClubSelectorOpen(false);
  };

  const createClub = async () => {
    if (!authUser) {
      return;
    }

    if (!createClubName.trim()) {
      setClubActionError("Club name is required.");
      return;
    }

    try {
      setClubActionLoading(true);
      setClubActionError(null);
      const createdClub = await createClubForUser({
        createdByUserId: authUser.id,
        name: createClubName.trim(),
        description: createClubDescription.trim(),
        vibe: createClubVibe.trim(),
      });

      await refreshClubs(authUser.id);
      setSelectedClubId(createdClub.id);
      setClubManagementMode("overview");
      setCreateClubName("");
      setCreateClubDescription("");
      setCreateClubVibe("");
    } catch (error) {
      setClubActionError(error instanceof Error ? error.message : "Could not create club.");
    } finally {
      setClubActionLoading(false);
    }
  };

  const joinSelectedClub = async () => {
    if (!authUser || !selectedJoinClub) {
      return;
    }

    try {
      setClubActionLoading(true);
      setClubActionError(null);
      await joinClubForUser(selectedJoinClub.id, authUser.id);
      await refreshClubs(authUser.id);
      setSelectedClubId(selectedJoinClub.id);
      setClubManagementMode("overview");
      setClubSearchTerm("");
    } catch (error) {
      setClubActionError(error instanceof Error ? error.message : "Could not join club.");
    } finally {
      setClubActionLoading(false);
    }
  };

  return {
    clubs,
    setClubs,
    allClubs,
    selectedClub,
    selectedClubMembers,
    currentClubBook,
    setCurrentClubBook,
    clubManagementMode,
    clubSelectorOpen,
    clubSearchTerm,
    joinableClubs,
    selectedJoinClub,
    selectedJoinClubMembers,
    createClubName,
    createClubDescription,
    createClubVibe,
    clubActionLoading,
    clubActionError,
    setClubSelectorOpen,
    setClubManagementMode,
    setClubSearchTerm,
    setSelectedJoinClubId,
    setCreateClubName,
    setCreateClubDescription,
    setCreateClubVibe,
    selectClub,
    createClub,
    joinSelectedClub,
  };
}
