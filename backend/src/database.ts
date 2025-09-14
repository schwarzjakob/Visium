import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export interface CreateObjectiveData {
  text: string;
}

export interface ObjectiveWithRelated {
  id: string;
  text: string;
  createdAt: Date;
  related: Array<{ id: string; text: string }>;
}

export async function createObjective(data: CreateObjectiveData) {
  return await prisma.objective.create({
    data: {
      text: data.text,
    },
  });
}

export async function getAllObjectives() {
  return await prisma.objective.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getObjectiveById(id: string) {
  return await prisma.objective.findUnique({
    where: { id },
  });
}

export async function searchObjectives(
  query: string, 
  limit: number = 50, 
  offset: number = 0
) {
  return await prisma.objective.findMany({
    where: {
      text: {
        contains: query,
        mode: 'insensitive',
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });
}

export async function getObjectivesForRelatedness() {
  return await prisma.objective.findMany({
    select: {
      id: true,
      text: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}