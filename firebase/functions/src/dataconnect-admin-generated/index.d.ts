import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface CompetencyScore_Key {
  id: UUIDString;
  __typename?: 'CompetencyScore_Key';
}

export interface CreateDemoDataData {
  user_insertMany: User_Key[];
  essayTheme_insertMany: EssayTheme_Key[];
  essay_insert: Essay_Key;
}

export interface DeleteEssayData {
  essay_delete?: Essay_Key | null;
}

export interface DeleteEssayVariables {
  id: UUIDString;
}

export interface EssayTheme_Key {
  id: UUIDString;
  __typename?: 'EssayTheme_Key';
}

export interface Essay_Key {
  id: UUIDString;
  __typename?: 'Essay_Key';
}

export interface GetMyProfileData {
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export interface LearningMaterial_Key {
  id: UUIDString;
  __typename?: 'LearningMaterial_Key';
}

export interface LearningPath_Key {
  id: UUIDString;
  __typename?: 'LearningPath_Key';
}

export interface ListEssayThemesData {
  essayThemes: ({
    id: UUIDString;
    title: string;
    description: string;
  } & EssayTheme_Key)[];
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface UpdateUserVariables {
  name: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'CreateDemoData' Mutation. Allow users to execute without passing in DataConnect. */
export function createDemoData(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDemoDataData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDemoData' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDemoData(options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDemoDataData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUser(dc: DataConnect, vars: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUser(vars: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteEssay' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteEssay(dc: DataConnect, vars: DeleteEssayVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteEssayData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteEssay' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteEssay(vars: DeleteEssayVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteEssayData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyProfile' Query. Allow users to execute without passing in DataConnect. */
export function getMyProfile(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyProfileData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyProfile' Query. Allow users to pass in custom DataConnect instances. */
export function getMyProfile(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyProfileData>>;

/** Generated Node Admin SDK operation action function for the 'ListEssayThemes' Query. Allow users to execute without passing in DataConnect. */
export function listEssayThemes(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListEssayThemesData>>;
/** Generated Node Admin SDK operation action function for the 'ListEssayThemes' Query. Allow users to pass in custom DataConnect instances. */
export function listEssayThemes(options?: OperationOptions): Promise<ExecuteOperationResponse<ListEssayThemesData>>;

