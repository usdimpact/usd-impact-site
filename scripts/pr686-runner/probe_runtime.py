"""Build-time measurement only; no database initialization or hosted access."""
import hashlib,json,pathlib,re,subprocess,platform
paths={'node':'/usr/local/bin/node','postgres':'/usr/local/pgsql/bin/postgres','initdb':'/usr/local/pgsql/bin/initdb','pg_ctl':'/usr/local/pgsql/bin/pg_ctl','postgrest':'/usr/local/bin/postgrest','python':'/usr/bin/python3'}
patterns={'node':r'v24\.20\.0','postgres':r'postgres \(PostgreSQL\) 17\.6','initdb':r'initdb \(PostgreSQL\) 17\.6','pg_ctl':r'pg_ctl \(PostgreSQL\) 17\.6','postgrest':r'PostgREST 14\.16(?: \([^\r\n]+\))?','python':r'Python 3\.(?:1[0-9]|[2-9][0-9])\.[0-9]+'}
if platform.machine()!='x86_64':raise RuntimeError('PLATFORM_MISMATCH')
entries={}
for name,path in paths.items():
 p=pathlib.Path(path);info=p.stat()
 if info.st_uid!=0 or info.st_mode&0o022:raise RuntimeError('UNTRUSTED_EXECUTABLE')
 result=subprocess.run([path,'--version'],capture_output=True,text=True,timeout=5,check=True,env={'PATH':'/usr/bin:/bin','LANG':'C'})
 version=(result.stdout or result.stderr).strip()
 if not re.fullmatch(patterns[name],version):raise RuntimeError('VERSION_MISMATCH_'+name+':'+version)
 entries[name]={'path':path,'version':version,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
print(json.dumps({'executables':entries,'architecture':'linux/amd64','databaseInitialized':False,'storageTestsExecuted':0,'hostedCompatibility':'NOT_VERIFIED','releaseAuthorized':False,'osPackagesSha256':hashlib.sha256(pathlib.Path('/opt/pr686/os-packages.txt').read_bytes()).hexdigest()},sort_keys=True))
